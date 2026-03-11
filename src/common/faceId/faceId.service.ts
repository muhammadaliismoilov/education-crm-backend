import { Injectable, OnModuleInit, BadRequestException, Logger } from '@nestjs/common';
import * as faceapi from '@vladmandic/face-api';
import { createCanvas, loadImage } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FaceService implements OnModuleInit {
  private modelsLoaded = false;
  private readonly logger = new Logger(FaceService.name);

  async onModuleInit() {
    await this.loadModels();
  }

  private async loadModels() {
  if (this.modelsLoaded) return;

  // ✅ dist/models yo'q bo'lsa, root/models dan qidiradi
  const modelsPath = fs.existsSync(path.join(__dirname, '..', '..', 'models'))
    ? path.join(__dirname, '..', '..', 'models')        // dist/models
    : path.join(process.cwd(), 'models');                // root/models

  const { Canvas, Image, ImageData } = require('canvas');
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

  this.logger.log(`📁 Models path: ${modelsPath}`);
  this.logger.log(`📁 Models exists: ${fs.existsSync(modelsPath)}`);

  if (!fs.existsSync(modelsPath)) {
    this.logger.error(`❌ Models papkasi topilmadi: ${modelsPath}`);
    throw new Error(`Models papkasi topilmadi: ${modelsPath}`);
  }

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

  this.modelsLoaded = true;
  this.logger.log('✅ Face recognition modellari yuklandi');
}

  // ✅ Fayl yo'lidan descriptor olish
  async getDescriptorFromFile(imagePath: string): Promise<number[]> {
    await this.loadModels();

    this.logger.log(`📸 Fayl descriptor: ${imagePath}`);
    this.logger.log(`📸 Fayl exists: ${fs.existsSync(imagePath)}`);

    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0);

    this.logger.log(`📸 Rasm o'lchami: ${img.width}x${img.height}`);

    const detection = await faceapi
      .detectSingleFace(canvas as any)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      this.logger.warn(`⚠️ Rasmda yuz topilmadi: ${imagePath}`);
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    this.logger.log(`✅ Descriptor olindi, score: ${detection.detection.score}`);
    return Array.from(detection.descriptor);
  }

  // ✅ Base64 dan descriptor olish
  async getDescriptorFromBase64(base64: string): Promise<number[]> {
    await this.loadModels();

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    this.logger.log(`📸 Base64 buffer size: ${buffer.length} bytes`);

    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0);

    this.logger.log(`📸 Rasm o'lchami: ${img.width}x${img.height}`);

    const detection = await faceapi
      .detectSingleFace(canvas as any)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      this.logger.warn('⚠️ Base64 rasmda yuz topilmadi');
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    this.logger.log(`✅ Base64 descriptor olindi, score: ${detection.detection.score}`);
    return Array.from(detection.descriptor);
  }

  // ✅ O'xshashlik hisoblash — .map(Number) qo'shildi
  getSimilarity(desc1: number[], desc2: number[]): number {
    // jsonb dan kelganda string bo'lib qolishi mumkin
    const d1 = new Float32Array(desc1.map(Number));
    const d2 = new Float32Array(desc2.map(Number));
    const distance = faceapi.euclideanDistance(d1, d2);
    const similarity = Math.max(0, Math.round((1 - distance / 0.6) * 100));
    return similarity;
  }
}