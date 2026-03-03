import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Student } from '../entities/students.entity';
import { StudentDiscount } from '../entities/studentDiscount';


@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Group, Student,StudentDiscount]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
