import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { Student } from '../entities/students.entity';
import type { Cache } from 'cache-manager';
import { User, UserRole } from '../entities/user.entity';
import { Expense } from '../entities/expense.entity';
import * as ExcelJS from 'exceljs';
import * as express from 'express';
import { SalaryService } from '../salarys/salary.service';

//  Redis uchun sekundda (millisekund emas!)
const CACHE_TTL = {
  monthly: 5 * 60, // 5 daqiqa
  yearly: 30 * 60, // 30 daqiqa
  teacher: 5 * 60, // 5 daqiqa
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    private salaryService: SalaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getYearlyFinancialOverview(year: number, user?: any) {
    const branchId = user && user.role !== 'superadmin' ? user.branchId : null;
    const cacheKey = `finance_yearly_${year}_${branchId || 'all'}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);

    // ─── 1. DAROMAD - oylar bo'yicha ─────────────────────────────────
    const incomeQuery = this.paymentRepo
      .createQueryBuilder('p')
      .select([
        `EXTRACT(MONTH FROM p."createdAt") AS month`,
        `SUM(CAST(p.amount AS DECIMAL))    AS "totalIncome"`,
      ])
      .where(`p."createdAt" BETWEEN :start AND :end`, { start, end });
    if (branchId) incomeQuery.andWhere('p.branchId = :branchId', { branchId });
    const incomeByMonth = await incomeQuery
      .groupBy(`EXTRACT(MONTH FROM p."createdAt")`)
      .getRawMany();

    // ─── 1.5 XARAJATLAR - oylar bo'yicha ──────────────────────────────
    const expenseQuery = this.expenseRepo
      .createQueryBuilder('e')
      .select([
        `EXTRACT(MONTH FROM e."createdAt") AS month`,
        `SUM(CAST(e.amount AS DECIMAL))    AS "totalExpense"`,
      ])
      .where(`e."createdAt" BETWEEN :start AND :end`, { start, end })
      .andWhere('e."deletedAt" IS NULL');
    if (branchId) expenseQuery.andWhere('e.branchId = :branchId', { branchId });
    const expensesByMonth = await expenseQuery
      .groupBy(`EXTRACT(MONTH FROM e."createdAt")`)
      .getRawMany();

    // ─── 2. QARZDORLIK - oylar bo'yicha ──────────────────────────────
    // Active student-group memberships in the branch
    const membershipsQuery = this.studentRepo.manager
      .createQueryBuilder()
      .select([
        's.id                                                        AS "studentId"',
        'g.id                                                        AS "groupId"',
        `CASE WHEN sd."customPrice" > 0 THEN sd."customPrice" ELSE CAST(g.price AS DECIMAL) END AS "effectivePrice"`,
      ])
      .from('students', 's')
      .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
      .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
      .leftJoin(
        'student_discounts',
        'sd',
        'sd."studentId" = s.id AND sd."groupId" = g.id',
      )
      .where('s."deletedAt" IS NULL');
    if (branchId) membershipsQuery.andWhere('s."branchId" = :branchId', { branchId });
    const memberships = await membershipsQuery.getRawMany();

    // Payments for the year grouped by month, student, and group
    const paymentsQuery = this.paymentRepo
      .createQueryBuilder('p')
      .select([
        `EXTRACT(MONTH FROM p."createdAt") AS month`,
        `p."studentId"                     AS "studentId"`,
        `p."groupId"                       AS "groupId"`,
        `SUM(CAST(p.amount AS DECIMAL))    AS "totalPaid"`,
      ])
      .where(`p."createdAt" BETWEEN :start AND :end`, { start, end })
      .groupBy(`EXTRACT(MONTH FROM p."createdAt"), p."studentId", p."groupId"`);
    if (branchId) paymentsQuery.andWhere('p.branchId = :branchId', { branchId });
    const paymentsByMonth = await paymentsQuery.getRawMany();

    // Fast lookup map: key = "month_studentId_groupId" -> totalPaid
    const paymentsMap = new Map<string, number>();
    for (const p of paymentsByMonth) {
      const key = `${Number(p.month)}_${p.studentId}_${p.groupId}`;
      paymentsMap.set(key, Number(p.totalPaid || 0));
    }

    // ─── 3. O'QITUVCHILAR OYLIKLARINI - oylar bo'yicha ───────────────
    const teacherQuery: any = { role: UserRole.TEACHER };
    if (branchId) teacherQuery.branch = { id: branchId };
    const teachers = await this.userRepo.find({
      where: teacherQuery,
    });

    const monthlyNames = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentyabr',
      'Oktyabr',
      'Noyabr',
      'Dekabr',
    ];

    const monthlySalaries = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const monthNum = i + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        const lastDay = new Date(year, monthNum, 0).getDate();
        const startStr = `${year}-${monthStr}-01`;
        const endStr = `${year}-${monthStr}-${lastDay}`;

        const results = await Promise.all(
          teachers.map((teacher) =>
            this.salaryService
              .calculateTeacherSalary(teacher.id, startStr, endStr)
              .catch((e) => {
                this.logger.warn(
                  `Oylik xatolik [teacher: ${teacher.id}, oy: ${monthNum}]: ${e.message}`,
                );
                return { totalSalary: 0 };
              }),
          ),
        );

        return {
          month: monthNum,
          totalSalary: results.reduce(
            (sum, r) => sum + (r?.totalSalary || 0),
            0,
          ),
        };
      }),
    );

    // ─── 4. 12 OYNI MAP QILISH ────────────────────────────────────────
    let summaryIncome = 0;
    let summaryPending = 0;
    let summaryTeacherSal = 0;
    let summaryExpenses = 0;

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;

      const incomeRow = incomeByMonth.find((r) => Number(r.month) === monthNum);
      const totalIncome = Number(incomeRow?.totalIncome || 0);

      let totalPending = 0;
      for (const membership of memberships) {
        const effectivePrice = Number(membership.effectivePrice || 0);
        const key = `${monthNum}_${membership.studentId}_${membership.groupId}`;
        const totalPaid = paymentsMap.get(key) || 0;
        if (effectivePrice > totalPaid) {
          totalPending += effectivePrice - totalPaid;
        }
      }

      const expenseRow = expensesByMonth.find((r) => Number(r.month) === monthNum);
      const totalExpenses = Number(expenseRow?.totalExpense || 0);

      const salaryRow = monthlySalaries.find((r) => r.month === monthNum);
      const totalTeacherSalaries = salaryRow?.totalSalary || 0;
      const netProfit = totalIncome - totalTeacherSalaries - totalExpenses;

      summaryIncome += totalIncome;
      summaryPending += totalPending;
      summaryTeacherSal += totalTeacherSalaries;
      summaryExpenses += totalExpenses;

      return {
        month: monthNum,
        monthName: monthlyNames[i],
        totalIncome,
        totalPending,
        totalTeacherSalaries,
        totalExpenses,
        netProfit,
      };
    });

    // ─── 5. YILLIK SUMMARY ────────────────────────────────────────────
    const summary = {
      totalIncome: summaryIncome,
      totalPending: summaryPending,
      totalTeacherSalaries: summaryTeacherSal,
      totalExpenses: summaryExpenses,
      netProfit: summaryIncome - summaryTeacherSal - summaryExpenses,
      currency: "so'm",
      generatedAt: new Date(),
      period: { from: start, to: end },
    };

    const result = { summary, monthlyData };

    try {
      await this.cacheManager.set(cacheKey, result, CACHE_TTL.yearly);
    } catch (e) {
      this.logger.warn(`Cache set xatolik [${cacheKey}]: ${e.message}`);
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // 1. MOLIYAVIY TAHLIL (Kunlik va Oylik)
  // ─────────────────────────────────────────────
  async getFinancialOverview(startDate: Date, endDate: Date, user?: any) {
    const branchId = user && user.role !== 'superadmin' ? user.branchId : null;
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}_${branchId || 'all'}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    // 1. Kunlik daromad (Income by day)
    const incomeQuery = this.paymentRepo
      .createQueryBuilder('p')
      .select([
        "TO_CHAR(p.createdAt AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS date",
        'SUM(CAST(p.amount AS DECIMAL)) AS income',
      ])
      .where('p."createdAt" BETWEEN :start AND :end', { start, end });
    if (branchId) incomeQuery.andWhere('p.branchId = :branchId', { branchId });
    const dailyIncomeRaw = await incomeQuery
      .groupBy(
        "TO_CHAR(p.createdAt AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')",
      )
      .getRawMany();

    const incomeMap = new Map(
      dailyIncomeRaw.map((r) => [r.date, Number(r.income || 0)]),
    );

    // 1.5 Jami xarajatlar
    const expenseQuery = this.expenseRepo
      .createQueryBuilder('e')
      .select('SUM(CAST(e.amount AS DECIMAL)) AS expense')
      .where('e."createdAt" BETWEEN :start AND :end', { start, end })
      .andWhere('e."deletedAt" IS NULL');
    if (branchId) expenseQuery.andWhere('e.branchId = :branchId', { branchId });
    const expenseRaw = await expenseQuery.getRawOne();
    const totalExpenses = Number(expenseRaw?.expense || 0);

    // 2. Qarzdorlik (Pending amount)
    // Active student-group memberships in the branch
    const membershipsQuery = this.studentRepo.manager
      .createQueryBuilder()
      .select([
        's.id                                                        AS "studentId"',
        'g.id                                                        AS "groupId"',
        `CASE WHEN sd."customPrice" > 0 THEN sd."customPrice" ELSE CAST(g.price AS DECIMAL) END AS "effectivePrice"`,
      ])
      .from('students', 's')
      .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
      .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
      .leftJoin(
        'student_discounts',
        'sd',
        'sd."studentId" = s.id AND sd."groupId" = g.id',
      )
      .where('s."deletedAt" IS NULL');
    if (branchId) membershipsQuery.andWhere('s."branchId" = :branchId', { branchId });
    const memberships = await membershipsQuery.getRawMany();

    // Payments for the given date range, grouped by student and group
    const paymentsQuery = this.paymentRepo
      .createQueryBuilder('p')
      .select([
        'p."studentId"                     AS "studentId"',
        'p."groupId"                       AS "groupId"',
        'SUM(CAST(p.amount AS DECIMAL))    AS "totalPaid"',
      ])
      .where('p."createdAt" BETWEEN :start AND :end', { start, end })
      .groupBy('p."studentId", p."groupId"');
    if (branchId) paymentsQuery.andWhere('p.branchId = :branchId', { branchId });
    const paymentsList = await paymentsQuery.getRawMany();

    // Fast lookup map: key = "studentId_groupId" -> totalPaid
    const paymentsMap = new Map<string, number>();
    for (const p of paymentsList) {
      paymentsMap.set(`${p.studentId}_${p.groupId}`, Number(p.totalPaid || 0));
    }

    let totalPending = 0;
    for (const membership of memberships) {
      const effectivePrice = Number(membership.effectivePrice || 0);
      const totalPaid = paymentsMap.get(`${membership.studentId}_${membership.groupId}`) || 0;
      if (effectivePrice > totalPaid) {
        totalPending += effectivePrice - totalPaid;
      }
    }

    // 3. O'qituvchilar oyligi (Salaries)
    const teacherQuery: any = { role: UserRole.TEACHER };
    if (branchId) teacherQuery.branch = { id: branchId };
    const teachers = await this.userRepo.find({ where: teacherQuery });

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const salaryResults = await Promise.all(
      teachers.map((t) =>
        this.salaryService
          .calculateTeacherSalary(t.id, startStr, endStr)
          .catch(() => ({ totalSalary: 0 })),
      ),
    );

    const totalTeacherSalaries = salaryResults.reduce(
      (sum, res) => sum + (res?.totalSalary || 0),
      0,
    );

    // 4. O'qituvchilar joriy oyi uchun jami oyliklarni summaryda ko'rsatamiz
    const totalIncome = Array.from(incomeMap.values()).reduce((a, b) => a + b, 0);
    const result = {
      totalIncome: Math.round(totalIncome),
      totalPending,
      totalTeacherSalaries: Math.round(totalTeacherSalaries),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(
        totalIncome - totalTeacherSalaries - totalExpenses,
      ),
      currency: "so'm",
      generatedAt: new Date(),
      period: { from: start, to: end },
    };

    try {
      await this.cacheManager.set(cacheKey, result, CACHE_TTL.monthly);
    } catch (e) {
      this.logger.warn(`Cache set xatolik [${cacheKey}]: ${e.message}`);
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // 2. QARZDORLAR EXCEL EXPORT
  // ─────────────────────────────────────────────
  async exportDebtorsToExcel(res: express.Response, user?: any) {
    const branchId = user && user.role !== 'superadmin' ? user.branchId : null;
    const rawQuery = this.studentRepo.manager
      .createQueryBuilder()
      .select([
        's.id                                                        AS "studentId"',
        's.fullName                                                  AS "fullName"',
        's.phone                                                     AS "phone"',
        'g.id                                                        AS "groupId"',
        'g.name                                                      AS "groupName"',
        `CASE WHEN sd."customPrice" > 0 THEN sd."customPrice" ELSE CAST(g.price AS DECIMAL) END AS "groupPrice"`,
        `COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0)                 AS "totalPaid"`,
      ])
      .from('students', 's')
      .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
      .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
      .leftJoin(
        'student_discounts',
        'sd',
        'sd."studentId" = s.id AND sd."groupId" = g.id',
      )
      .leftJoin('payments', 'p', 'p."studentId" = s.id AND p."groupId" = g.id')
      .where('s."deletedAt" IS NULL');
    if (branchId) rawQuery.andWhere('s."branchId" = :branchId', { branchId });
    const rawDebts = await rawQuery
      .groupBy(
        's.id, s.fullName, s.phone, g.id, g.name, sd."customPrice", g.price',
      )
      .having(
        `CASE WHEN sd."customPrice" > 0 THEN sd."customPrice" ELSE CAST(g.price AS DECIMAL) END > COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0)`,
      )
      .orderBy('s.fullName', 'ASC')
      .getRawMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Qarzdorlar');

    worksheet.columns = [
      { header: '№', key: 'index', width: 5 },
      { header: 'Talaba F.I.SH', key: 'fullName', width: 30 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Guruh', key: 'groupName', width: 20 },
      { header: 'Kurs Narxi', key: 'coursePrice', width: 15 },
      { header: "To'langan Summa", key: 'paidAmount', width: 15 },
      { header: 'Qarz Miqdori', key: 'debt', width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'C0392B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let totalDebt = 0;

    rawDebts.forEach((item, index) => {
      const groupPrice = Number(item.groupPrice || 0);
      const totalPaid = Number(item.totalPaid || 0);
      const debt = groupPrice - totalPaid;
      totalDebt += debt;

      const row = worksheet.addRow({
        index: index + 1,
        fullName: item.fullName || "Noma'lum",
        phone: item.phone || '-',
        groupName: item.groupName || 'Guruhsiz',
        coursePrice: `${groupPrice.toLocaleString()} so'm`,
        paidAmount: `${totalPaid.toLocaleString()} so'm`,
        debt: `${debt.toLocaleString()} so'm`,
      });

      if (debt > 500000) {
        row.getCell('debt').font = { color: { argb: 'C0392B' }, bold: true };
      }
    });

    worksheet.addRow({
      index: '',
      fullName: 'JAMI QARZ:',
      phone: '',
      groupName: '',
      coursePrice: '',
      paidAmount: '',
      debt: `${totalDebt.toLocaleString()} so'm`,
    }).font = { bold: true };

    const totalRow = worksheet.lastRow;
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F9EBEA' },
    };

    const fileName = `Qarzdorlar_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  // ─────────────────────────────────────────────
  // 3. O'QITUVCHILAR SAMARADORLIGI
  // ─────────────────────────────────────────────
  async getTeacherPerformance(
    startDate: Date,
    endDate: Date,
    user?: any,
    page = 1,
    limit = 10,
  ) {
    const branchId = user && user.role !== 'superadmin' ? user.branchId : null;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cacheKey = `teacher_performance_${start.getTime()}_${end.getTime()}_${branchId || 'all'}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    const attQuery = this.groupRepo
      .createQueryBuilder('g')
      .leftJoin('g.teacher', 't')
      .leftJoin('g.attendances', 'a', 'a.date BETWEEN :start AND :end', {
        start,
        end,
      })
      .select([
        't.id                                                 AS teacher_id',
        't.fullName                                           AS teacher_name',
        'g.id                                                 AS group_id',
        'g.name                                               AS group_name',
        'COUNT(DISTINCT a.date)                               AS total_lessons',
        'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) AS attended_count',
      ])
      .where('t.id IS NOT NULL');
    if (branchId) attQuery.andWhere('g.branchId = :branchId', { branchId });
    const attendanceData = await attQuery
      .groupBy('t.id, t.fullName, g.id, g.name')
      .getRawMany();

    const groupIds = attendanceData.map((d) => d.group_id).filter(Boolean);

    const studentCounts =
      groupIds.length > 0
        ? await this.studentRepo
            .createQueryBuilder('s')
            .leftJoin('s.enrolledGroups', 'g')
            .select(['g.id AS group_id', 'COUNT(s.id) AS student_count'])
            .where('g.id IN (:...groupIds)', { groupIds })
            .groupBy('g.id')
            .getRawMany()
        : [];

    const studentCountMap = new Map<string, number>(
      studentCounts.map((row) => [
        row.group_id,
        Number(row.student_count || 0),
      ]),
    );

    const result = attendanceData.map((item) => {
      const totalLessons = Number(item.total_lessons) || 0;
      const attendedCount = Number(item.attended_count) || 0;
      const studentCount = studentCountMap.get(item.group_id) || 0;
      const shouldAttend = totalLessons * studentCount;
      const attendanceRate =
        shouldAttend > 0
          ? Math.min(Math.round((attendedCount / shouldAttend) * 100), 100)
          : 0;

      return {
        teacherId: item.teacher_id,
        teacherName: item.teacher_name,
        groupName: item.group_name,
        totalLessons,
        totalStudents: studentCount,
        shouldAttend,
        attendedCount,
        attendanceRate,
      };
    });

    const totalItems = result.length;
    const paginatedData = result.slice((page - 1) * limit, page * limit);

    const finalResult = {
      data: paginatedData,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
    };

    try {
      await this.cacheManager.set(cacheKey, finalResult, CACHE_TTL.teacher);
    } catch (e) {
      this.logger.warn(`Cache set xatolik [${cacheKey}]: ${e.message}`);
    }

    return finalResult;
  }
}
