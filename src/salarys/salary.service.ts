import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import {
  SalaryPayout,
  SalaryPayoutStatus,
} from '../entities/salaryPayout.entity';
import { Attendance } from '../entities/attendance.entity';
import { PaySalaryDto } from './salary.dto';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(SalaryPayout)
    private payoutRepo: Repository<SalaryPayout>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    private dataSource: DataSource,
  ) {}

  // 1. BARCHA O'QITUVCHILAR OYLIGI (Dashboard uchun)
  async getEstimatedSalaries(
    startDate?: string,
    endDate?: string,
    user?: any,
    page = 1,
    limit = 10,
  ) {
    const now = new Date();
    const start =
      startDate ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end =
      endDate ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

    const query: any = { role: UserRole.TEACHER };
    if (user && user.role !== UserRole.SUPERADMIN) {
      query.branch = { id: user.branchId };
    }

    const teachers = await this.userRepo.find({
      where: query,
      relations: ['teachingGroups'],
    });

    let totalPaidCount = 0;
    let totalUnpaidCount = 0;

    const reportPromises = teachers.map(async (teacher) => {
      // Mavjud to'lovni tekshirish (Faqat PAID statusdagilarni hisobga olamiz)
      const existingPayout = await this.payoutRepo.findOne({
        where: {
          teacher: { id: teacher.id },
          startDate: new Date(start),
          endDate: new Date(end),
          status: SalaryPayoutStatus.PAID,
        },
      });

      const salaryData = await this.calculateTeacherSalary(
        teacher.id,
        start,
        end,
      ).catch((err) => {
        this.logger.warn(
          `Oylik hisoblashda xatolik [teacher: ${teacher.id}]: ${err.message}`,
        );
        return { totalSalary: 0, details: [] };
      });

      // Darslar sonini hisoblash
      const totalLessons = (salaryData.details as any[]).reduce(
        (sum: number, d: any) => sum + (d.attendanceCount || 0),
        0,
      );

      const status = existingPayout ? 'PAID' : 'UNPAID';
      
      // Fan (Subject) - birinchi guruh nomidan olishga harakat qilamiz yoki default
      const subject = teacher.teachingGroups?.[0]?.name?.split('-')[0] || 'O\'qituvchi';

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        subject: subject,
        calculatedSalary: salaryData.totalSalary,
        totalLessons,
        startDate: start,
        endDate: end,
        status,
        paidAt: existingPayout?.paidAt || null,
        payoutId: existingPayout?.id || null,
        details: salaryData.details,
      };
    });

    const report = await Promise.all(reportPromises);

    totalPaidCount = report.filter((r) => r.status === 'PAID').length;
    totalUnpaidCount = report.length - totalPaidCount;

    const totalItems = report.length;
    const paginatedData = report.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      summary: {
        totalTeachers: totalItems,
        totalPaid: totalPaidCount,
        totalUnpaid: totalUnpaidCount,
      },
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
      timestamp: new Date().toISOString(),
      startDate: start,
      endDate: end,
    };
  }

  // 2. BITTA O'QITUVCHI OYLIGI HISOBLASH
  async calculateTeacherSalary(
    teacherId: string,
    startDate: string,
    endDate: string,
    user?: any,
  ) {
    const query: any = { id: teacherId, role: UserRole.TEACHER };
    if (user && user.role !== UserRole.SUPERADMIN) {
      query.branch = { id: user.branchId };
    }

    const teacher = await this.userRepo.findOne({
      where: query,
      relations: ['teachingGroups'],
    });

    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    const percentage = teacher.salaryPercentage ?? 0;
    if (percentage === 0)
      throw new BadRequestException("O'qituvchi foizi belgilanmagan");

    const dayMapping: Record<string, number> = {
      Yakshanba: 0,
      Dushanba: 1,
      Seshanba: 2,
      Chorshanba: 3,
      Payshanba: 4,
      Juma: 5,
      Shanba: 6,
    };

    const groupIds = teacher.teachingGroups.map((g) => g.id);

    if (groupIds.length === 0) {
      return {
        teacherName: teacher.fullName,
        startDate,
        endDate,
        totalSalary: 0,
        details: [],
      };
    }

    const studentsWithDiscounts = await this.userRepo.manager
      .createQueryBuilder()
      .select([
        's.id            AS "studentId"',
        'g.id            AS "groupId"',
        'g.price         AS "groupPrice"',
        'sd.customPrice  AS "customPrice"',
      ])
      .from('students', 's')
      .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
      .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
      .leftJoin(
        'student_discounts',
        'sd',
        'sd."studentId" = s.id AND sd."groupId" = g.id',
      )
      .where('g.id IN (:...groupIds)', { groupIds })
      .andWhere('s."deletedAt" IS NULL')
      .getRawMany();

    const studentsByGroup = new Map<string, typeof studentsWithDiscounts>();
    for (const row of studentsWithDiscounts) {
      if (!studentsByGroup.has(row.groupId)) {
        studentsByGroup.set(row.groupId, []);
      }
      studentsByGroup.get(row.groupId).push(row);
    }

    const months = this.getMonthsInRange(startDate, endDate);

    let totalSalary = 0;
    const details: {
      groupName: string;
      groupDays: number[];
      totalLessonsInMonth: number;
      perLessonRate: number;
      attendanceCount: number;
      teacherEarned: number;
    }[] = [];

    for (const group of teacher.teachingGroups) {
      const rawDays = group.days?.length > 0 ? group.days : [];
      const numericDays = rawDays
        .map((d: string) => dayMapping[d])
        .filter((d: number | undefined) => d !== undefined);

      if (numericDays.length === 0) continue;

      const students = studentsByGroup.get(group.id) || [];
      if (students.length === 0) continue;

      let groupAttendanceCount = 0;
      let groupTeacherEarned = 0;
      let totalPerLessonRate = 0;
      let lastMonthLessons = 0;

      for (const { year, month } of months) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const monthLessons = this.countSpecificDaysInMonth(
          monthStr,
          numericDays,
        );

        if (monthLessons === 0) continue;

        lastMonthLessons = monthLessons;

        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const rangeStart =
          new Date(startDate) > monthStart ? new Date(startDate) : monthStart;
        const rangeEnd =
          new Date(endDate) < monthEnd ? new Date(endDate) : monthEnd;

        const rangeStartStr = rangeStart.toISOString().split('T')[0];
        const rangeEndStr = rangeEnd.toISOString().split('T')[0];

        const monthAttendance = await this.attendanceRepo
          .createQueryBuilder('a')
          .select('a.studentId', 'studentId')
          .addSelect('COUNT(*)', 'count')
          .where('a.groupId = :groupId', { groupId: group.id })
          .andWhere('a.date BETWEEN :start AND :end', {
            start: rangeStartStr,
            end: rangeEndStr,
          })
          .andWhere('a.isPresent = true')
          .groupBy('a.studentId')
          .getRawMany();

        const monthAttMap = new Map<string, number>(
          monthAttendance.map((r) => [r.studentId, Number(r.count || 0)]),
        );

        for (const student of students) {
          const rawCustom =
            student.customPrice !== null ? Number(student.customPrice) : 0;
          const effectivePrice =
            rawCustom > 0 ? rawCustom : Number(student.groupPrice);

          const perLessonRate = effectivePrice / monthLessons;
          const attendanceCount = monthAttMap.get(student.studentId) || 0;
          const teacherEarned = Math.round(
            ((perLessonRate * percentage) / 100) * attendanceCount,
          );

          groupAttendanceCount += attendanceCount;
          groupTeacherEarned += teacherEarned;
          totalPerLessonRate += perLessonRate;
        }
      }

      if (groupTeacherEarned === 0) continue;

      const avgPerLessonRate =
        students.length > 0
          ? Math.round(totalPerLessonRate / students.length)
          : Math.round(Number(group.price) / (lastMonthLessons || 1));

      totalSalary += groupTeacherEarned;

      details.push({
        groupName: group.name,
        groupDays: numericDays,
        totalLessonsInMonth: lastMonthLessons,
        perLessonRate: avgPerLessonRate,
        attendanceCount: groupAttendanceCount,
        teacherEarned: Math.round(groupTeacherEarned),
      });
    }

    const totalLessons = details.reduce((sum, d) => sum + d.attendanceCount, 0);
    const averageHourlyRate = totalLessons > 0 ? Math.round(totalSalary / totalLessons) : 0;
    
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const daysCount = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      teacherName: teacher.fullName,
      startDate,
      endDate,
      daysCount,
      totalLessons,
      averageHourlyRate,
      totalSalary: Math.round(totalSalary),
      details,
    };
  }

  // HELPER — sana oralig'idagi oylar ro'yxati
  private getMonthsInRange(
    startDate: string,
    endDate: string,
  ): { year: number; month: number }[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months: { year: number; month: number }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  // HELPER — oy ichidagi guruh kunlarini sanash
  private countSpecificDaysInMonth(
    monthStr: string,
    daysToCount: number[],
  ): number {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    let count = 0;

    while (date.getMonth() === month - 1) {
      if (daysToCount.includes(date.getDay())) {
        count++;
      }
      date.setDate(date.getDate() + 1);
    }

    return count;
  }

  // 3. OYLIK TO'LASH
  async paySalary(dto: PaySalaryDto, user?: any) {
    const { teacherId, month, startDate, endDate } = dto;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const forMonth = startDate.substring(0, 7);

    if (start > end) {
      throw new BadRequestException(
        'Boshlanish sanasi tugash sanasidan keyin bo\'lishi mumkin emas',
      );
    }

    if (month !== forMonth) {
      throw new BadRequestException(
        "To'lov oyi boshlanish sanasi oyiga mos bo'lishi kerak",
      );
    }

    const query: any = { id: teacherId, role: UserRole.TEACHER };
    if (user && user.role !== UserRole.SUPERADMIN) {
      query.branch = { id: user.branchId };
    }

    const teacher = await this.userRepo.findOne({
      where: query,
      relations: ['branch'],
    });
    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(SalaryPayout, {
        where: {
          teacher: { id: teacherId },
          startDate: start,
          endDate: end,
          status: SalaryPayoutStatus.PAID,
        },
      });

      if (existing)
        throw new BadRequestException(
          "Ushbu sana oralig'i uchun oylik allaqachon to'langan",
        );

      const salaryData = await this.calculateTeacherSalary(
        teacherId,
        startDate,
        endDate,
        user,
      );

      if (salaryData.totalSalary <= 0) {
        throw new BadRequestException(
          "Ushbu sana oralig'i uchun to'lanadigan oylik mavjud emas",
        );
      }

      const payout = queryRunner.manager.create(SalaryPayout, {
        amount: salaryData.totalSalary,
        forMonth,
        status: SalaryPayoutStatus.PAID,
        startDate: start,
        endDate: end,
        calculationDetails: salaryData,
        teacher: { id: teacherId },
        paidBy: user?.id ? { id: user.id } : null,
        branch: teacher.branch ? { id: teacher.branch.id } : null,
      });

      const saved = await queryRunner.manager.save(payout);
      await queryRunner.commitTransaction();

      // SABABI: Moliyaviy to'lov — kim, qanchaga, qaysi oy audit uchun muhim
      this.logger.log(
        `Oylik to'landi [teacher: ${teacherId}] [oy: ${forMonth}] [summa: ${salaryData.totalSalary}] [paidBy: ${user?.id ?? 'unknown'}]`,
      );

      return { message: 'Oylik muvaffaqiyatli saqlandi', payout: saved };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // SABABI: Moliyaviy xatolik — rollback bo'lganini logga yozish
      this.logger.error(
        `Oylik to'lashda xatolik [teacher: ${teacherId}] [oy: ${month}]`,
        err.stack,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 4. BARCHA TO'LANGAN OYLIKLAR
  async findAll(searchMonth?: string, user?: any, page = 1, limit = 10) {
    const query = this.payoutRepo
      .createQueryBuilder('payout')
      .withDeleted()
      .leftJoinAndSelect('payout.teacher', 'teacher')
      .orderBy('payout.createdAt', 'DESC');

    if (user && user.role !== UserRole.SUPERADMIN) {
      query.andWhere('payout.branchId = :branchId', {
        branchId: user.branchId,
      });
    }

    if (searchMonth) {
      query.andWhere('payout.forMonth = :month', { month: searchMonth });
    }

    const [items, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
    };
  }

  // 5. BITTA TO'LOV
  async findOne(id: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      relations: ['teacher'],
      withDeleted: true,
    });
    if (!payout) throw new NotFoundException("Oylik to'lovi topilmadi");
    return payout;
  }

  // 6. TO'LOVNI YANGILASH
  async update(id: string, amount: number) {
    const payout = await this.findOne(id);

    // TUZATISH: Eski summani logga yozish — moliyaviy o'zgarish audit uchun
    this.logger.log(
      `Oylik yangilandi [id: ${id}] [eski: ${payout.amount}] [yangi: ${amount}]`,
    );

    payout.amount = amount;
    return await this.payoutRepo.save(payout);
  }

  // 7. TO'LOVNI O'CHIRISH
  async remove(id: string) {
    const payout = await this.findOne(id);

    // SABABI: Moliyaviy yozuvni o'chirish — qaytarib bo'lmaydigan harakat, audit uchun (Soft Delete va Cancel statusi)
    this.logger.log(
      `Oylik bekor qilindi (soft delete) [id: ${id}] [teacher: ${payout.teacher?.id}] [summa: ${payout.amount}]`,
    );

    payout.status = SalaryPayoutStatus.CANCELLED;
    await this.payoutRepo.save(payout);

    return await this.payoutRepo.softRemove(payout);
  }
}
