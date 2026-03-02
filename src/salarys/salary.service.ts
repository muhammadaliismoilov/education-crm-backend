import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { SalaryPayout } from '../entities/salaryPayout.entity';
import { Attendance } from '../entities/attendance.entity';
import { PaySalaryDto } from './salary.dto';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(SalaryPayout)
    private payoutRepo: Repository<SalaryPayout>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    private dataSource: DataSource,
  ) {}

  // 1. BARCHA O'QITUVCHILAR OYLIGI
  async getEstimatedSalaries(startDate?: string, endDate?: string) {
    const now = new Date();
    const start =
      startDate ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end =
      endDate ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

    const teachers = await this.userRepo.find({
      where: { role: UserRole.TEACHER },
    });

    const report: any[] = [];

    for (const teacher of teachers) {
      const salaryData = await this.calculateTeacherSalary(
        teacher.id,
        start,
        end,
      ).catch(() => ({ totalSalary: 0, details: [] }));

      if (salaryData.totalSalary > 0) {
        report.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          calculatedSalary: salaryData.totalSalary,
          startDate: start,
          endDate: end,
          details: salaryData.details,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      startDate: start,
      endDate: end,
      teachersCount: report.length,
      data: report,
    };
  }

  // 2. BITTA O'QITUVCHI OYLIGI HISOBLASH
  async calculateTeacherSalary(
    teacherId: string,
    startDate: string,
    endDate: string,
  ) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
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

    // ✅ 1. Barcha talabalar + discountlar — bitta query
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

    // ✅ 2. Students Map — guruh bo'yicha
    const studentsByGroup = new Map<string, typeof studentsWithDiscounts>();
    for (const row of studentsWithDiscounts) {
      if (!studentsByGroup.has(row.groupId)) {
        studentsByGroup.set(row.groupId, []);
      }
      studentsByGroup.get(row.groupId)!.push(row);
    }

    // ✅ 3. Oylar ro'yxati
    const months = this.getMonthsInRange(startDate, endDate);

    // ✅ 4. Hisoblash
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

        // ✅ TO'LIQ OY darslar soni — perLessonRate uchun
        const monthLessons = this.countSpecificDaysInMonth(
          monthStr,
          numericDays,
        );
        if (monthLessons === 0) continue;

        lastMonthLessons = monthLessons;

        // Bu oydagi range chegarasi
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const rangeStart =
          new Date(startDate) > monthStart ? new Date(startDate) : monthStart;
        const rangeEnd =
          new Date(endDate) < monthEnd ? new Date(endDate) : monthEnd;

        const rangeStartStr = rangeStart.toISOString().split('T')[0];
        const rangeEndStr = rangeEnd.toISOString().split('T')[0];

        // ✅ Bu oydagi davomat — bitta query (guruh bo'yicha)
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

        // ✅ Map — O(1) qidirish
        const monthAttMap = new Map<string, number>(
          monthAttendance.map((r) => [r.studentId, Number(r.count || 0)]),
        );

        for (const student of students) {
          const effectivePrice =
            student.customPrice !== null
              ? Number(student.customPrice)
              : Number(student.groupPrice);

          // ✅ perLessonRate — HAR DOIM to'liq oydan
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

      // O'rtacha perLessonRate — frontend uchun
      const avgPerLessonRate =
        students.length > 0
          ? Math.round(totalPerLessonRate / students.length)
          : Math.round(Number(group.price) / (lastMonthLessons || 1));

      totalSalary += groupTeacherEarned;

      details.push({
        groupName: group.name,
        groupDays: numericDays,
        totalLessonsInMonth: lastMonthLessons, // ✅ To'liq oy
        perLessonRate: avgPerLessonRate, // ✅ To'liq oydan
        attendanceCount: groupAttendanceCount,
        teacherEarned: Math.round(groupTeacherEarned),
      });
    }

    return {
      teacherName: teacher.fullName,
      startDate,
      endDate,
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
  async paySalary(dto: PaySalaryDto) {
    const { teacherId, month, amount } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(SalaryPayout, {
        where: { teacher: { id: teacherId }, forMonth: month },
      });
      if (existing)
        throw new BadRequestException("Bu oy uchun oylik allaqachon to'langan");

      const payout = queryRunner.manager.create(SalaryPayout, {
        amount,
        forMonth: month,
        teacher: { id: teacherId },
      });

      const saved = await queryRunner.manager.save(payout);
      await queryRunner.commitTransaction();
      return { message: 'Oylik muvaffaqiyatli saqlandi', payout: saved };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 4. BARCHA TO'LANGAN OYLIKLAR
  async findAll(searchMonth?: string) {
    const query = this.payoutRepo
      .createQueryBuilder('payout')
      .leftJoinAndSelect('payout.teacher', 'teacher')
      .orderBy('payout.createdAt', 'DESC');

    if (searchMonth) {
      query.where('payout.forMonth = :month', { month: searchMonth });
    }

    return await query.getMany();
  }

  // 5. BITTA TO'LOV
  async findOne(id: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      relations: ['teacher'],
    });
    if (!payout) throw new NotFoundException("Oylik to'lovi topilmadi");
    return payout;
  }

  // 6. TO'LOVNI YANGILASH
  async update(id: string, amount: number) {
    const payout = await this.findOne(id);
    payout.amount = amount;
    return await this.payoutRepo.save(payout);
  }

  // 7. TO'LOVNI O'CHIRISH
  async remove(id: string) {
    const payout = await this.findOne(id);
    return await this.payoutRepo.remove(payout);
  }
}
