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
    
    // SENIOR: 1-QADAM - CPU Qotib qolmasligi uchun rasmni siqish
    let width = img.width;
    let height = img.height;
    const MAX_WIDTH = 600;
    if (width > MAX_WIDTH) {
      height = Math.round(height * (MAX_WIDTH / width));
      width = MAX_WIDTH;
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0, width, height);

    // Kichik yorug'likda ham ishlashi uchun minConfidence 0.3 (default: 0.5)
    const detection = await faceapi
      .detectSingleFace(canvas as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
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

    // SENIOR: 1-QADAM - CPU Qotib qolmasligi uchun rasmni siqish
    let width = img.width;
    let height = img.height;
    const MAX_WIDTH = 600;
    if (width > MAX_WIDTH) {
      height = Math.round(height * (MAX_WIDTH / width));
      width = MAX_WIDTH;
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0, width, height);

    const detection = await faceapi
      .detectSingleFace(canvas as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      this.logger.warn('Base64 rasmda yuz topilmadi');
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    return Array.from(detection.descriptor);
  }

  getSimilarity(desc1: number[], desc2: number[]): number {
    if (!desc1 || !desc2 || desc1.length === 0 || desc2.length === 0) return 0;

    const d1 = new Float32Array(desc1.map(Number));
    const d2 = new Float32Array(desc2.map(Number));

    const distance = faceapi.euclideanDistance(d1, d2);

    // Odatda face-api.js da 0.6 dan past masofa bitta odam deb hisoblanadi.
    // Biz 0.6 ni 0% oxshashlik nuqtasi qilib belgilaymiz (yani qat'iyroq).
    // Masofa qancha kichik bo'lsa, similarity shuncha yuqori bo'ladi.
    const threshold = 0.6;
    const similarity = Math.max(
      0,
      Math.round((1 - distance / threshold) * 100),
    );

    return similarity;
  }
}
