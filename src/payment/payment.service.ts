import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  // 1. Create with Balance Sync
  async create(dto: CreatePaymentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const payment = queryRunner.manager.create(Payment, {
        ...dto,
        student: { id: dto.studentId },
        group: { id: dto.groupId },
      });
      const saved = await queryRunner.manager.save(payment);
      await queryRunner.manager.increment(
        User,
        { id: dto.studentId },
        'balance',
        dto.amount,
      );
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  // 2. Find All with Search and Pagination
  async findAll(search?: string, page = 1, limit = 10) {
    const query = this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.student', 'student')
      .leftJoinAndSelect('payment.group', 'group');

    if (search) {
      query.where('student.fullName ILike :search', { search: `%${search}%` });
    }

    const [items, total] = await query
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // 3. Find One
  async findOne(id: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group'],
    });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');
    return payment;
  }

  // 4. Update (Summa o'zgarsa balans ham o'zgaradi)
  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.amount && dto.amount !== payment.amount) {
        const diff = dto.amount - payment.amount;
        await queryRunner.manager.increment(
          User,
          { id: payment.student.id },
          'balance',
          diff,
        );
      }
      Object.assign(payment, dto);
      const updated = await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  // 5. Delete (To'lov o'chirilsa balansdan ayiriladi)
  async remove(id: string) {
    const payment = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.decrement(
        User,
        { id: payment.student.id },
        'balance',
        payment.amount,
      );
      await queryRunner.manager.remove(payment);
      await queryRunner.commitTransaction();
      return { message: 'To‘lov o‘chirildi va balans tahrirlandi' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
