import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import * as faceapi from '@vladmandic/face-api';
import { createCanvas, loadImage } from 'canvas';
import * as path from 'path';

@Injectable()
export class FaceService implements OnModuleInit {
  private modelsLoaded = false;

  async onModuleInit() {
    await this.loadModels();
  }
  


  
  private async loadModels() {
    if (this.modelsLoaded) return;

    const modelsPath = path.join(process.cwd(), 'models');

    // Canvas patch
    const { Canvas, Image, ImageData } = require('canvas');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

    this.modelsLoaded = true;
    console.log('✅ Face recognition modellari yuklandi');
  }

  // Fayl yolidan descriptor olish
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
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    return Array.from(detection.descriptor);
  }

  // Base64 dan descriptor olish (frontend kameradan)
  async getDescriptorFromBase64(base64: string): Promise<number[]> {
    await this.loadModels();

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
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
      throw new BadRequestException('Rasmda yuz topilmadi!');
    }

    return Array.from(detection.descriptor);
  }

  // O'xshashlik foizini hisoblash
  getSimilarity(desc1: number[], desc2: number[]): number {
    const d1 = new Float32Array(desc1);
    const d2 = new Float32Array(desc2);
    const distance = faceapi.euclideanDistance(d1, d2);

    // 0.0 = 100% bir xil, 0.6+ = boshqa odam
    const similarity = Math.max(0, Math.round((1 - distance / 0.6) * 100));
    return similarity;
  }
}