import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';
import { Student } from 'src/entities/students.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  // 1. To'lov yaratish va Balansni sinxronlash
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

      // Talaba balansini oshiramiz
      await queryRunner.manager.increment(
        Student,
        { id: dto.studentId },
        'balance',
        Number(dto.amount),
      );
      await (this.cacheManager.stores as any).reset();
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException("To'lovni saqlashda xato: " + err.message);
    } finally {
      await queryRunner.release();
    }
  }

  // 2. Ro'yxatni olish (Qarz mantiqi bilan)
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

    // Rasmda ko'rsatilgan qarz mantiqini qo'shamiz
    const formattedItems = items.map((payment) => {
      const coursePrice = Number(payment.group?.price || 0);
      const paidAmount = Number(payment.amount || 0);

      // Qarz = Kurs narxi - To'langan summa
      const debt = coursePrice - paidAmount;

      return {
        ...payment,
        coursePrice,
        debt, // Frontend buni -300,000 kabi ko'rsatishi uchun
        isFullyPaid: debt <= 0,
      };
    });

    return {
      items: formattedItems,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group'],
    });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');
    return payment;
  }

  // Chek uchun ma'lumotlarni shakllantirish
  async getReceiptData(paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['student', 'group'],
    });

    if (!payment) throw new NotFoundException('To‘lov topilmadi');

    const coursePrice = Number(payment.group?.price || 0);
    const paidAmount = Number(payment.amount);
    const debt = coursePrice - paidAmount;

    return {
      receiptNumber: payment.id.split('-')[0].toUpperCase(), // Qisqa chek raqami
      date: payment.createdAt.toLocaleString('sv-SE'),
      student: {
        fullName: payment.student.fullName,
        phone: payment.student.phone,
        currentBalance: payment.student.balance,
      },
      group: {
        name: payment.group.name,
        price: coursePrice,
      },
      payment: {
        amount: paidAmount,
        debt: debt > 0 ? debt : 0, // Agar qarz bo'lsa
        overpayment: debt < 0 ? Math.abs(debt) : 0, // Agar ortiqcha to'lov bo'lsa
      },
      centerName: 'Ali Edu CRM Center', // O'quv markaz nomi
    };
  }

  // 3. To'lovni tahrirlash (Farq hisobi bilan)
  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (
        dto.amount !== undefined &&
        Number(dto.amount) !== Number(payment.amount)
      ) {
        const diff = Number(dto.amount) - Number(payment.amount);

        // Faqat farqni balansga qo'shamiz/ayiramiz
        await queryRunner.manager.increment(
          Student,
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

  // 4. To'lovni o'chirish (Balansni qaytarish)
  async remove(id: string) {
    const payment = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // O'chirilayotgan to'lovni balansdan ayiramiz
      await queryRunner.manager.decrement(
        Student,
        { id: payment.student.id },
        'balance',
        Number(payment.amount),
      );

      await queryRunner.manager.remove(payment);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'To‘lov o‘chirildi va balans to‘g‘rilandi',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
