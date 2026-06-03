import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './payment.dto';
import { Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { Invoice } from '../entities/invoice.entity';
import { StudentDiscount } from '../entities/studentDiscount';
import { RedisCacheService } from '../common/redis/redis.cache';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(StudentDiscount)
    private discountRepo: Repository<StudentDiscount>,
    private dataSource: DataSource,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  // HELPER — talabaning guruh uchun haqiqiy narxini olish
  private async getEffectivePrice(
    studentId: string,
    groupId: string,
    groupPrice: number,
  ): Promise<number> {
    const discount = await this.discountRepo.findOne({
      where: {
        student: { id: studentId },
        group: { id: groupId },
      },
    });
    return discount ? Number(discount.customPrice) : groupPrice;
  }

  // HELPER — student umumiy balansini hisoblash va yangilash
  private async recalculateStudentBalance(
    queryRunner: any,
    studentId: string,
    excludePaymentId?: string,
  ): Promise<void> {
    const student = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: ['enrolledGroups'],
    });

    if (!student) return;

    const allPaymentsQuery = queryRunner.manager
      .createQueryBuilder(Payment, 'p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId });

    if (excludePaymentId) {
      allPaymentsQuery.andWhere('p.id != :id', { id: excludePaymentId });
    }

    const allPaymentsResult = await allPaymentsQuery.getRawOne();
    const allTotalPaid = Number(allPaymentsResult?.totalPaid || 0);

    const allInvoicesQuery = queryRunner.manager
      .createQueryBuilder(Invoice, 'i')
      .select('SUM(CAST(i.amount AS DECIMAL))', 'totalInvoiced')
      .where('i.studentId = :studentId', { studentId });

    const allInvoicesResult = await allInvoicesQuery.getRawOne();
    const allTotalInvoiced = Number(allInvoicesResult?.totalInvoiced || 0);

    await queryRunner.manager.update(
      Student,
      { id: studentId },
      { balance: allTotalPaid - allTotalInvoiced },
    );
  }

  async create(dto: CreatePaymentDto, user: AuthenticatedUser) {
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
        relations: ['enrolledGroups', 'branch'],
      });

      if (!student) throw new BadRequestException('Talaba topilmadi');
      if (
        user &&
        user.role !== 'superadmin' &&
        student.branch?.id !== user.branchId
      ) {
        throw new BadRequestException(
          "Boshqa filial talabasiga to'lov qila olmaysiz",
        );
      }
      if (!student.enrolledGroups || student.enrolledGroups.length === 0)
        throw new BadRequestException('Talaba hech qanday guruhga yozilmagan');
      if (!student.enrolledGroups.some((g) => g.id === groupId))
        throw new BadRequestException('Talaba bu guruhga yozilmagan');

      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
      });
      if (!group) throw new BadRequestException('Guruh topilmadi');

      const discount = await queryRunner.manager.findOne(StudentDiscount, {
        where: {
          student: { id: studentId },
          group: { id: groupId },
        },
      });

      // ✅ Imtiyoz 0 dan katta bo'lsagina ishlatiladi, aks holda group.price olinadi
      const rawCustomPrice = discount ? Number(discount.customPrice) : 0;
      const coursePrice =
        rawCustomPrice > 0 ? rawCustomPrice : Number(group.price || 0);

      if (coursePrice === 0)
        throw new BadRequestException('Guruh narxi belgilanmagan');

      const previousPayments = await queryRunner.manager.find(Payment, {
        where: { student: { id: studentId }, group: { id: groupId } },
      });

      const totalPaidAmount = previousPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
      );

      const totalPaid = totalPaidAmount + newPayment;
      const balance = totalPaid - coursePrice;
      const debt = balance < 0 ? Math.abs(balance) : 0;
      const advanceBalance = balance > 0 ? balance : 0;
      const isFullyPaid = totalPaid >= coursePrice;
      const coverageMonths = Math.floor(totalPaid / coursePrice);

      const payment = queryRunner.manager.create(Payment, {
        ...dto,
        amount: newPayment,
        debt,
        student: { id: studentId },
        group: { id: groupId },
        branch: student.branch ? { id: student.branch.id } : null,
      });

      const saved = await queryRunner.manager.save(payment);

      await this.recalculateStudentBalance(queryRunner, studentId);
      await queryRunner.commitTransaction();

      // ✅ Cache tozalash
      await this.redisCacheService.invalidateFinanceCache();

      // SABABI: Moliyaviy operatsiya — kim, qancha to'ladi audit uchun
      this.logger.log(
        `To'lov yaratildi [id: ${saved.id}] [student: ${studentId}] [group: ${groupId}] [summa: ${newPayment}]`,
      );

      return {
        ...saved,
        debt,
        advanceBalance,
        coverageMonths,
        coursePrice,
        paidAmount: totalPaid,
        isFullyPaid,
        hasDiscount: !!discount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) throw err;
      // SABABI: Kutilmagan xatolik — stack bilan loglansin
      this.logger.error("To'lov yaratishda xatolik", err.stack);
      throw new InternalServerErrorException(
        "To'lov saqlashda xatolik yuz berdi",
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 10,
    user?: AuthenticatedUser,
    branchId?: string,
  ) {
    const query = this.paymentRepo
      .createQueryBuilder('payment')
      .withDeleted()
      .leftJoinAndSelect('payment.student', 'student')
      .leftJoinAndSelect('payment.group', 'group')
      .leftJoinAndSelect('payment.branch', 'branch');

    // TypeORM QueryBuilder-da join orqali o'chirilganlarni olish uchun 'withDeleted' parametr sifatida joinValue-da beriladi.

    // Muhim: O'chirilgan o'quvchilarni ham ko'rish uchun QueryBuilder-da withDeleted student uchun ham kerak
    // TypeORM QueryBuilder-da leftJoinAndSelect + withDeleted birga ishlaydi.

    if (user && user.role !== 'superadmin') {
      query.andWhere('payment.branchId = :branchId', {
        branchId: user.branchId,
      });
    } else if (branchId) {
      query.andWhere('payment.branchId = :branchId', { branchId });
    }

    if (search) {
      const cleanSearch = search.replace(/[\s\-\(\)]/g, '');
      query.andWhere(
        '(student.fullName ILike :search OR student.phone ILike :cleanSearch)',
        { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
      );
    }

    const [items, total] = await query
      .orderBy('payment.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getManyAndCount();

    const studentGroupPairs = [
      ...new Map(
        items.map((p) => [
          `${p.student?.id}_${p.group?.id}`,
          { studentId: p.student?.id, groupId: p.group?.id },
        ]),
      ).values(),
    ];

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

    const studentIds = [
      ...new Set(items.map((p) => p.student?.id).filter(Boolean)),
    ];

    const discounts =
      studentIds.length > 0
        ? await this.discountRepo.find({
            where: { student: { id: In(studentIds) } },
            relations: ['group'],
          })
        : [];

    const formattedItems = items.map((payment) => {
      const key = `${payment.student?.id}_${payment.group?.id}`;
      const totalPaid = totalPaidMap.get(key) || Number(payment.amount || 0);

      const discount = discounts.find(
        (d) =>
          d.student?.id === payment.student?.id &&
          d.group?.id === payment.group?.id,
      );

      // ✅ Imtiyoz bo'lsa customPrice, bo'lmasa yoki 0 bo'lsa group.price
      const rawCustomPrice = discount ? Number(discount.customPrice) : 0;
      const coursePrice =
        rawCustomPrice > 0 ? rawCustomPrice : Number(payment.group?.price || 0);

      return {
        ...payment,
        coursePrice,
        paidAmount: totalPaid,
        isFullyPaid: Number(payment.debt || 0) <= 0,
        hasDiscount: !!discount,
      };
    });

    return {
      data: formattedItems,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group', 'branch'],
      withDeleted: true, // student o'chirilgan bo'lsa ham topishi uchun (TypeORM global withDeleted)
    });
    if (!payment) throw new NotFoundException("To'lov topilmadi");
    if (
      user &&
      user.role !== 'superadmin' &&
      payment.branch?.id !== user.branchId
    ) {
      throw new NotFoundException("To'lov topilmadi");
    }

    const totalPaidResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId: payment.student?.id })
      .andWhere('p.groupId = :groupId', { groupId: payment.group?.id })
      .getRawOne();

    const discount = await this.discountRepo.findOne({
      where: {
        student: { id: payment.student?.id },
        group: { id: payment.group?.id },
      },
    });

    // ✅ Imtiyoz 0 dan katta bo'lsagina ishlatiladi
    const rawCustomPrice = discount ? Number(discount.customPrice) : 0;
    const coursePrice =
      rawCustomPrice > 0 ? rawCustomPrice : Number(payment.group?.price || 0);
    const totalPaidAmount = Number(totalPaidResult?.totalPaid || 0);
    const debt = Math.max(0, coursePrice - totalPaidAmount);

    return {
      ...payment,
      coursePrice,
      paidAmount: totalPaidAmount,
      isFullyPaid: debt <= 0,
      debt,
      hasDiscount: !!discount,
    };
  }

  async getReceiptData(paymentId: string, user: AuthenticatedUser) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['student', 'group', 'branch'],
      withDeleted: true,
    });
    if (!payment) throw new NotFoundException("To'lov topilmadi");
    if (!payment.student)
      throw new BadRequestException(
        "Talaba ma'lumoti topilmadi (butkul o'chirilgan)",
      );
    if (
      user &&
      user.role !== 'superadmin' &&
      payment.branch?.id !== user.branchId
    ) {
      throw new NotFoundException("To'lov topilmadi");
    }

    const discount = await this.discountRepo.findOne({
      where: {
        student: { id: payment.student?.id },
        group: { id: payment.group?.id },
      },
    });

    // ✅ Imtiyoz 0 dan katta bo'lsagina ishlatiladi
    const rawCustomPrice = discount ? Number(discount.customPrice) : 0;
    const coursePrice =
      rawCustomPrice > 0 ? rawCustomPrice : Number(payment.group?.price || 0);

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
        fullName: payment.student?.fullName || 'Arxivlangan talaba',
        phone: payment.student?.phone || '',
        currentBalance: payment.student?.balance || 0,
      },
      group: {
        name: payment.group.name,
        originalPrice: Number(payment.group.price),
        price: coursePrice,
        hasDiscount: !!discount,
      },
      payment: {
        amount: Number(payment.amount),
        totalPaid,
        debt: balance < 0 ? Math.abs(balance) : 0,
        overpayment: balance > 0 ? balance : 0,
        isFullyPaid: balance >= 0,
      },
      centerName: 'Ali Edu CRM Center',
    };
  }

  async update(id: string, dto: UpdatePaymentDto, user: AuthenticatedUser) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group', 'branch'],
    });
    if (!payment) throw new NotFoundException("To'lov topilmadi");
    if (
      user &&
      user.role !== 'superadmin' &&
      payment.branch?.id !== user.branchId
    ) {
      throw new NotFoundException("To'lov topilmadi");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const studentId = payment.student.id;
      const groupId = payment.group.id;

      if (dto.amount !== undefined) {
        const newAmount = Number(dto.amount);

        const discount = await queryRunner.manager.findOne(StudentDiscount, {
          where: { student: { id: studentId }, group: { id: groupId } },
        });

        // ✅ Imtiyoz 0 dan katta bo'lsagina ishlatiladi, aks holda group.price
        const rawCustomPrice = discount ? Number(discount.customPrice) : 0;
        const coursePrice =
          rawCustomPrice > 0
            ? rawCustomPrice
            : Number(payment.group?.price || 0);

        const otherPaymentsResult = await queryRunner.manager
          .createQueryBuilder(Payment, 'p')
          .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
          .where('p.studentId = :studentId', { studentId })
          .andWhere('p.groupId = :groupId', { groupId })
          .andWhere('p.id != :id', { id })
          .getRawOne();

        const otherPaid = Number(otherPaymentsResult?.totalPaid || 0);
        const totalPaid = otherPaid + newAmount;
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

        await this.recalculateStudentBalance(queryRunner, studentId);
      } else if (dto.paymentDate) {
        await queryRunner.manager.update(
          Payment,
          { id },
          { paymentDate: dto.paymentDate },
        );
      }

      await queryRunner.commitTransaction();

      // ✅ Cache tozalash
      await this.redisCacheService.invalidateFinanceCache();

      // SABABI: Moliyaviy o'zgarish — audit uchun
      this.logger.log(
        `To'lov yangilandi [id: ${id}] [student: ${payment.student?.id}]`,
      );

      return await this.findOne(id, user);
    } catch (err) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      if (err instanceof NotFoundException) throw err;
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`To'lovni yangilashda xatolik [id: ${id}]`, err.stack);
      throw new InternalServerErrorException(
        "To'lovni yangilashda xatolik yuz berdi",
      );
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'group', 'branch'],
    });
    if (!payment) throw new NotFoundException("To'lov topilmadi");
    if (
      user &&
      user.role !== 'superadmin' &&
      payment.branch?.id !== user.branchId
    ) {
      throw new NotFoundException("To'lov topilmadi");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const studentId = payment.student.id;

      await queryRunner.manager.delete(Payment, { id });
      await this.recalculateStudentBalance(queryRunner, studentId);
      await queryRunner.commitTransaction();

      // ✅ Cache tozalash
      await this.redisCacheService.invalidateFinanceCache();

      // SABABI: Moliyaviy yozuv o'chirildi — audit uchun muhim
      this.logger.log(
        `To'lov o'chirildi [id: ${id}] [student: ${studentId}] [summa: ${payment.amount}]`,
      );

      return {
        success: true,
        message: "To'lov o'chirildi va balans to'g'rilandi",
      };
    } catch (err) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`To'lovni o'chirishda xatolik [id: ${id}]`, err.stack);
      throw new InternalServerErrorException(
        "To'lovni o'chirishda xatolik yuz berdi",
      );
    } finally {
      await queryRunner.release();
    }
  }
}
