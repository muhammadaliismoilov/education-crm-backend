import { Module } from '@nestjs/common';
import { FaceService } from './faceId.service';

@Module({
  providers: [FaceService],
  exports: [FaceService],
})
export class FaceModule {}