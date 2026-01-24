import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { Repository, ILike } from 'typeorm';
import { CreatePaymentDto } from './payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
  ) {}

  async create(dto: CreatePaymentDto) {
    const payment = this.paymentRepo.create({
      amount: dto.amount,
      paymentDate: dto.paymentDate,
      student: { id: dto.studentId },
      group: { id: dto.groupId },
    });
    return await this.paymentRepo.save(payment);
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.paymentRepo.findAndCount({
      where: search ? { student: { fullName: ILike(`%${search}%`) } } : {},
      relations: ['student', 'group', 'group.teacher'],
      order: { createdAt: 'DESC' }, // Tartiblashda ishlatilyapti
      take: limit,
      skip: skip,
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        createdAt: true, // MANA SHU QATORNI QO'SHING
        student: {
          id: true,
          fullName: true,
          phone: true,
        },
        group: {
          id: true,
          name: true,
          teacher: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      items,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
