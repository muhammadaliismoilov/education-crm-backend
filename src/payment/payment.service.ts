import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';
import { Student } from 'src/entities/students.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Group } from 'src/entities/group.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreatePaymentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { studentId, groupId, amount } = dto;
      const newPayment = Number(amount || 0);

      if (newPayment <= 0) {
        throw new BadRequestException(
          "To'lov miqdori 0 dan katta bo'lishi kerak",
        );
      }

      const student = await queryRunner.manager.findOne(Student, {
        where: { id: studentId },
        relations: ['enrolledGroups'],
      });

      if (!student) throw new BadRequestException('Talaba topilmadi');

      if (!student.enrolledGroups || student.enrolledGroups.length === 0) {
        throw new BadRequestException('Talaba hech qanday guruhga yozilmagan');
      }

      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
      });

      if (!group) throw new BadRequestException('Guruh topilmadi');

      const previousPayments = await queryRunner.manager.find(Payment, {
        where: {
          student: { id: studentId },
          group: { id: groupId },
        },
      });

      const totalPaidAmount = previousPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
      );

      const coursePrice = Number(group.price || 0);

      if (coursePrice === 0) {
        throw new BadRequestException('Guruh narxi belgilanmagan');
      }

      const totalPaid = totalPaidAmount + newPayment;

      const balance = totalPaid - coursePrice;

      let debt = 0;
      let advanceBalance = 0;

      if (balance < 0) {
        debt = Math.abs(balance);
        advanceBalance = 0;
      } else if (balance > 0) {
        debt = 0;
        advanceBalance = balance;
      } else {
        debt = 0;
        advanceBalance = 0;
      }

      const isFullyPaid = totalPaid >= coursePrice;

      const coverageMonths = Math.floor(totalPaid / coursePrice);

      const payment = queryRunner.manager.create(Payment, {
        ...dto,
        amount: newPayment,
        debt,
        student: { id: studentId },
        group: { id: groupId },
      });

      const saved = await queryRunner.manager.save(payment);

      // 9. Student UMUMIY balansini yangilash
      // Barcha guruhlar bo'yicha umumiy hisob
      const allPayments = await queryRunner.manager.find(Payment, {
        where: { student: { id: studentId } },
      });

      const allTotalPaid = allPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
      );

      const totalMonthlyPrice = student.enrolledGroups.reduce(
        (sum, g) => sum + Number(g.price || 0),
        0,
      );

      const overallBalance = allTotalPaid - totalMonthlyPrice;

      await queryRunner.manager.update(
        Student,
        { id: studentId },
        { balance: overallBalance },
      );

      // 10. Commit
      await queryRunner.commitTransaction();

      // 11. Cache tozalash
      try {
        const cache = this.cacheManager as any;
        if (cache?.reset) await cache.reset();
      } catch (_) {}

      // 12. ✅ To'g'ri javob — barcha fieldlar hisoblangan
      return {
        ...saved,
        debt,
        advanceBalance,
        coverageMonths,
        coursePrice, // ✅ Shu guruh narxi
        paidAmount: totalPaid, // ✅ JAMI to'langan (oldingi + yangi)
        isFullyPaid, // ✅ JAMI asosida
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();

      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException(
        "To'lov saqlashda xatolik yuz berdi",
      );
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

    // ✅ Har bir student+group kombinatsiyasi uchun JAMI to'lovni hisoblash
    // Bitta query bilan — N+1 yo'q
    const studentGroupPairs = [
      ...new Map(
        items.map((p) => [
          `${p.student?.id}_${p.group?.id}`,
          {
            studentId: p.student?.id,
            groupId: p.group?.id,
          },
        ]),
      ).values(),
    ];

    // Barcha kerakli student+group lar uchun jami to'lovlarni bitta query da olamiz
    const totalPaidMap = new Map<string, number>();

    if (studentGroupPairs.length > 0) {
      const totals = await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.studentId', 'studentId')
        .addSelect('p.groupId', 'groupId')
        .addSelect('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
        .where(
          studentGroupPairs
            .map((_, i) => `(p.studentId = :sid${i} AND p.groupId = :gid${i})`)
            .join(' OR '),
          Object.fromEntries(
            studentGroupPairs.flatMap((pair, i) => [
              [`sid${i}`, pair.studentId],
              [`gid${i}`, pair.groupId],
            ]),
          ),
        )
        .groupBy('p.studentId, p.groupId')
        .getRawMany();

      totals.forEach((row) => {
        totalPaidMap.set(
          `${row.studentId}_${row.groupId}`,
          Number(row.totalPaid || 0),
        );
      });
    }

    const formattedItems = items.map((payment) => {
      const coursePrice = Number(payment.group?.price || 0);
      const key = `${payment.student?.id}_${payment.group?.id}`;
      const totalPaid = totalPaidMap.get(key) || Number(payment.amount || 0);
      const debt = Math.max(0, coursePrice - totalPaid);

      return {
        ...payment,
        coursePrice,
        paidAmount: totalPaid, // ✅ JAMI to'langan
        isFullyPaid: debt <= 0, // ✅ JAMI asosida
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

    if (!payment) throw new NotFoundException("To'lov topilmadi");

    // ✅ Shu student + group uchun JAMI to'lovni hisoblash
    const totalPaid = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId: payment.student?.id })
      .andWhere('p.groupId = :groupId', { groupId: payment.group?.id })
      .getRawOne();

    const coursePrice = Number(payment.group?.price || 0);
    const totalPaidAmount = Number(totalPaid?.totalPaid || 0);
    const debt = Math.max(0, coursePrice - totalPaidAmount);

    return {
      ...payment,
      coursePrice,
      paidAmount: totalPaidAmount, // ✅ JAMI to'langan
      isFullyPaid: debt <= 0, // ✅ JAMI asosida
      debt, // ✅ To'g'ri hisoblangan
    };
  }

  async getReceiptData(paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['student', 'group'],
    });

    if (!payment) throw new NotFoundException("To'lov topilmadi");

    const coursePrice = Number(payment.group?.price || 0);

    // ✅ Shu student + group uchun JAMI to'lovni hisoblash
    const totalPaidResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId: payment.student?.id })
      .andWhere('p.groupId = :groupId', { groupId: payment.group?.id })
      .getRawOne();

    const totalPaid = Number(totalPaidResult?.totalPaid || 0);
    const balance = totalPaid - coursePrice;

    return {
      receiptNumber: payment.id.split('-')[0].toUpperCase(),
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
        amount: Number(payment.amount), // ✅ Faqat SHU to'lov summasi
        totalPaid, // ✅ Jami to'langan
        debt: balance < 0 ? 0 : balance, // ✅ Qarz (jami asosida)
        overpayment: balance > 0 ? balance : 0, // ✅ Ortiqcha (jami asosida)
        isFullyPaid: balance >= 0, // ✅ To'liq to'langan
      },
      centerName: 'Ali Edu CRM Center',
    };
  }

  // 3. To'lovni tahrirlash (Farq hisobi bilan)
  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group'],
    });

    if (!payment) throw new NotFoundException("To'lov topilmadi");

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const studentId = payment.student.id;
      const groupId = payment.group.id;

      if (dto.amount !== undefined) {
        const newAmount = Number(dto.amount);

        // Shu student+group uchun bu payment TASHQARI boshqa to'lovlar
        const otherPaymentsResult = await queryRunner.manager
          .createQueryBuilder(Payment, 'p')
          .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
          .where('p.studentId = :studentId', { studentId })
          .andWhere('p.groupId = :groupId', { groupId })
          .andWhere('p.id != :id', { id })
          .getRawOne();

        const otherPaid = Number(otherPaymentsResult?.totalPaid || 0);
        const totalPaid = otherPaid + newAmount;
        const coursePrice = Number(payment.group?.price || 0);
        const balance = totalPaid - coursePrice;

        const debt = balance < 0 ? Math.abs(balance) : 0;
        const advanceBalance = balance > 0 ? balance : 0;

        await queryRunner.manager.update(
          Payment,
          { id },
          {
            amount: newAmount,
            debt,
            advanceBalance,
            ...(dto.paymentDate && { paymentDate: dto.paymentDate }),
          },
        );

        // Student umumiy balansini qayta hisoblash
        const allPaymentsResult = await queryRunner.manager
          .createQueryBuilder(Payment, 'p')
          .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
          .where('p.studentId = :studentId', { studentId })
          .andWhere('p.id != :id', { id })
          .getRawOne();

        const allOtherPaid = Number(allPaymentsResult?.totalPaid || 0);
        const allTotalPaid = allOtherPaid + newAmount;

        const student = await queryRunner.manager.findOne(Student, {
          where: { id: studentId },
          relations: ['enrolledGroups'],
        });

        const totalMonthlyPrice =
          student?.enrolledGroups?.reduce(
            (sum, g) => sum + Number(g.price || 0),
            0,
          ) || 0;

        const overallBalance = allTotalPaid - totalMonthlyPrice;

        await queryRunner.manager.update(
          Student,
          { id: studentId },
          {
            balance: overallBalance,
          },
        );
      } else if (dto.paymentDate) {
        await queryRunner.manager.update(
          Payment,
          { id },
          {
            paymentDate: dto.paymentDate,
          },
        );
      }

      await queryRunner.commitTransaction();

      // ✅ Commit dan KEYIN yangilangan ma'lumotni olamiz — transaction tashqarida
      const updated = await this.paymentRepo.findOne({
        where: { id },
        relations: ['student', 'group'],
      });

      return {
        ...updated,
        coursePrice: Number(updated?.group?.price || 0),
        paidAmount: Number(updated?.amount || 0),
        isFullyPaid: Number(updated?.debt || 0) <= 0,
      };
    } catch (err) {
      // ✅ Transaction hali aktiv bo'lsagina rollback qilamiz
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (err instanceof NotFoundException) throw err;
      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException(
        "To'lovni yangilashda xatolik yuz berdi",
      );
    } finally {
      // ✅ Har doim release
      await queryRunner.release();
    }
  }

 async remove(id: string) {
  const payment = await this.paymentRepo.findOne({
    where: { id },
    relations: ['student', 'group'], // ✅ faqat shu ikki relation
  });

  if (!payment) throw new NotFoundException("To'lov topilmadi");

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const studentId = payment.student.id;

    // O'chiramiz
    await queryRunner.manager.delete(Payment, { id });

    // Qolgan to'lovlar asosida balansni qayta hisoblash
    const remainingResult = await queryRunner.manager
      .createQueryBuilder(Payment, 'p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId })
      .getRawOne();

    const remainingPaid = Number(remainingResult?.totalPaid || 0);

    // ✅ Student ni enrolledGroups bilan yuklash
    const student = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: ['enrolledGroups'], // ✅ Student da bor
    });

    const totalMonthlyPrice =
      student?.enrolledGroups?.reduce(
        (sum, g) => sum + Number(g.price || 0),
        0,
      ) || 0;

    const overallBalance = remainingPaid - totalMonthlyPrice;

    await queryRunner.manager.update(
      Student,
      { id: studentId },
      { balance: overallBalance },
    );

    await queryRunner.commitTransaction();

    return {
      success: true,
      message: "To'lov o'chirildi va balans to'g'rilandi",
    };
  } catch (err) {
    // ✅ Transaction aktiv bo'lsagina rollback
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    if (err instanceof NotFoundException) throw err;
    if (err instanceof BadRequestException) throw err;
    throw new InternalServerErrorException(
      "To'lovni o'chirishda xatolik yuz berdi",
    );
  } finally {
    await queryRunner.release();
  }
}
}
