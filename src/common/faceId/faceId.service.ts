import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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

    const modelsPath = fs.existsSync(path.join(__dirname, '..', '..', 'models'))
      ? path.join(__dirname, '..', '..', 'models')
      : path.join(process.cwd(), 'models');

    const { Canvas, Image, ImageData } = require('canvas');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    if (!fs.existsSync(modelsPath)) {
      // SABABI: Server ishga tushmasa darhol bilinsin — kritik xato
      this.logger.error(`Models papkasi topilmadi: ${modelsPath}`);
      throw new Error(`Models papkasi topilmadi: ${modelsPath}`);
    }

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

    this.modelsLoaded = true;
    // SABABI: Modellar yuklandi — server tayyor ekanini tasdiqlash
    this.logger.log(`Face recognition modellari yuklandi: ${modelsPath}`);
  }

  async getDescriptorFromFile(imagePath: string): Promise<number[]> {
    await this.loadModels();

    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0);

    const detection = await faceapi
      .detectSingleFace(canvas as any)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      // SABABI: Yuz topilmadi — warn, chunki foydalanuvchi xatosi, server xatosi emas
      this.logger.warn(`Rasmda yuz topilmadi: ${imagePath}`);
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    return Array.from(detection.descriptor);
  }

  async getDescriptorFromBase64(base64: string): Promise<number[]> {
    await this.loadModels();

    const base64Data = base64
      .replace(/\s+/g, '')
      .replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0);

    const detection = await faceapi
      .detectSingleFace(canvas as any)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      this.logger.warn('Base64 rasmda yuz topilmadi');
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    return Array.from(detection.descriptor);
  }

  getSimilarity(desc1: number[], desc2: number[]): number {
    const d1 = new Float32Array(desc1.map(Number));
    const d2 = new Float32Array(desc2.map(Number));
    const distance = faceapi.euclideanDistance(d1, d2);
    const similarity = Math.max(0, Math.round((1 - distance / 0.6) * 100));
    return similarity;
  }
}
