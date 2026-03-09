import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { Student } from '../entities/students.entity';
import type { Cache } from 'cache-manager';
import { User, UserRole } from '../entities/user.entity';
import * as ExcelJS from 'exceljs';
import * as express from 'express';
import { SalaryService } from '../salarys/salary.service';

const CACHE_TTL = 3 * 60 * 1000; // 3 daqiqa (ms)

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private salaryService: SalaryService,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─────────────────────────────────────────────
  // 1. MOLIYAVIY TAHLIL
  // ─────────────────────────────────────────────
async getFinancialOverview(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);  
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999); 

  const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}`;

  try {
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  // 1. Sana oralig'idagi daromad
  const paymentsData = await this.paymentRepo
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.group', 'g')
    .leftJoinAndSelect('p.student', 's')
    .where('p.createdAt BETWEEN :start AND :end', { start, end })
    .getMany();

  const totalIncome = paymentsData.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0,
  );

  // 2. BARCHA talabalarning umumiy qarzi
  // Sana oralig'iga bog'liq EMAS — har doim umumiy qarz
  const allDebts = await this.paymentRepo
    .createQueryBuilder('p')
    .leftJoin('p.student', 's')
    .leftJoin('p.group', 'g')
    .leftJoin(
      'student_discounts',
      'sd',
      'sd."studentId" = s.id AND sd."groupId" = g.id',
    )
    .select([
      's.id                                      AS "studentId"',
      'g.id                                      AS "groupId"',
      // Discount bor bo'lsa customPrice, yo'q bo'lsa group.price
      `COALESCE(sd."customPrice", CAST(g.price AS DECIMAL)) AS "effectivePrice"`,
      'SUM(CAST(p.amount AS DECIMAL))             AS "totalPaid"',
    ])
    .where('s.id IS NOT NULL')
    .groupBy('s.id, g.id, sd."customPrice", g.price')
    .getRawMany();

  // Faqat qarzlilarni yig'amiz
  let totalPending = 0;
  for (const row of allDebts) {
    const effectivePrice = Number(row.effectivePrice || 0);
    const totalPaid = Number(row.totalPaid || 0);
    if (effectivePrice > totalPaid) {
      totalPending += effectivePrice - totalPaid;
    }
  }

  // 3. O'qituvchilar oyligi
  const teachers = await this.userRepo.find({
    where: { role: UserRole.TEACHER },
  });

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const salaryResults = await Promise.all(
    teachers.map((teacher) =>
      this.salaryService
        .calculateTeacherSalary(teacher.id, startStr, endStr)
        .catch(() => ({ totalSalary: 0 })),
    ),
  );

  const totalTeacherSalaries = salaryResults.reduce(
    (sum, res) => sum + (res?.totalSalary || 0), 0,
  );

  const netProfit = totalIncome - totalTeacherSalaries;

  const result = {
    totalIncome,         // Sana oralig'idagi daromad
    totalPending,        // BARCHA talabalarning umumiy qarzi
    totalTeacherSalaries,
    netProfit,
    currency: "so'm",
    generatedAt: new Date(),
    period: { from: start, to: end },
  };

  try {
    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
  } catch (_) {}

  return result;
}




  // ─────────────────────────────────────────────
  // 2. QARZDORLAR EXCEL EXPORT
  // ─────────────────────────────────────────────
 async exportDebtorsToExcel(res: express.Response) {
  // Student dan boshlaymiz — to'lov yo'q bo'lsa ham chiqsin
  const rawDebts = await this.studentRepo.manager
    .createQueryBuilder()
    .select([
      's.id                                                        AS "studentId"',
      's.fullName                                                  AS "fullName"',
      's.phone                                                     AS "phone"',
      'g.id                                                        AS "groupId"',
      'g.name                                                      AS "groupName"',
      `COALESCE(sd."customPrice", CAST(g.price AS DECIMAL))        AS "groupPrice"`,
      `COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0)                 AS "totalPaid"`,
    ])
    .from('students', 's')
    .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
    .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
    .leftJoin('student_discounts', 'sd', 'sd."studentId" = s.id AND sd."groupId" = g.id')
    .leftJoin('payments', 'p', 'p."studentId" = s.id AND p."groupId" = g.id')
    .where('s."deletedAt" IS NULL')
    .groupBy('s.id, s.fullName, s.phone, g.id, g.name, sd."customPrice", g.price')
    .having(
      `COALESCE(sd."customPrice", CAST(g.price AS DECIMAL)) > COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0)`
    )
    .orderBy('s.fullName', 'ASC')
    .getRawMany();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Qarzdorlar');

  worksheet.columns = [
    { header: '№',                key: 'index',       width: 5  },
    { header: 'Talaba F.I.SH',   key: 'fullName',    width: 30 },
    { header: 'Telefon',          key: 'phone',       width: 20 },
    { header: 'Guruh',            key: 'groupName',   width: 20 },
    { header: 'Kurs Narxi',       key: 'coursePrice', width: 15 },
    { header: "To'langan Summa", key: 'paidAmount',  width: 15 },
    { header: 'Qarz Miqdori',     key: 'debt',        width: 15 },
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
    const totalPaid  = Number(item.totalPaid  || 0);
    const debt       = groupPrice - totalPaid;
    totalDebt += debt;

    const row = worksheet.addRow({
      index:       index + 1,
      fullName:    item.fullName  || "Noma'lum",
      phone:       item.phone     || '-',
      groupName:   item.groupName || 'Guruhsiz',
      coursePrice: `${groupPrice.toLocaleString()} so'm`,
      paidAmount:  `${totalPaid.toLocaleString()} so'm`,
      debt:        `${debt.toLocaleString()} so'm`,
    });

    if (debt > 500000) {
      row.getCell('debt').font = { color: { argb: 'C0392B' }, bold: true };
    }
  });

  const totalRow = worksheet.addRow({
    index:       '',
    fullName:    'JAMI QARZ:',
    phone:       '',
    groupName:   '',
    coursePrice: '',
    paidAmount:  '',
    debt:        `${totalDebt.toLocaleString()} so'm`,
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F9EBEA' },
  };

  const today    = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const fileName = `Qarzdorlar_${today}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
}

  // ─────────────────────────────────────────────
  // 3. O'QITUVCHILAR SAMARADORLIGI
  // ─────────────────────────────────────────────
  async getTeacherPerformance(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cacheKey = `teacher_performance_${start.getTime()}_${end.getTime()}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // 1. ATTENDANCE ma'lumotlari — student JOIN YO'Q!
    const attendanceData = await this.groupRepo
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
      .where('t.id IS NOT NULL')
      .groupBy('t.id, t.fullName, g.id, g.name')
      .getRawMany();

    // 2. STUDENT COUNT — attendance JOIN YO'Q!
    const groupIds = attendanceData.map((d) => d.group_id).filter(Boolean);

    const studentCounts =
      groupIds.length > 0
        ? await this.studentRepo
            .createQueryBuilder('s')
            .leftJoin('s.enrolledGroups', 'g')
            .select([
              'g.id          AS group_id',
              'COUNT(s.id)   AS student_count',
            ])
            .where('g.id IN (:...groupIds)', { groupIds })
            .groupBy('g.id')
            .getRawMany()
        : [];

    // group_id → student_count map
    const studentCountMap = new Map<string, number>(
      studentCounts.map((row) => [
        row.group_id,
        Number(row.student_count || 0),
      ]),
    );

    // 3. Birlashtirish
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

    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
    return result;
  }
}
