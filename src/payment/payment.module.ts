import { Module } from '@nestjs/common';
import { PaymentsService } from './payment.service';
import { PaymentsController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { Group } from 'src/entities/group.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Payment,User,Group])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentModule {}
