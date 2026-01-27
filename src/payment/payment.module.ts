import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { Group } from 'src/entities/group.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports:[TypeOrmModule.forFeature([Payment,User,Group])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
