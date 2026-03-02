// import { Injectable, Inject, BadRequestException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { CACHE_MANAGER, CacheKey } from '@nestjs/cache-manager';
// import { Payment } from '../entities/payment.entity';
// import { Group } from '../entities/group.entity';
// import { Attendance } from '../entities/attendance.entity';
// import { Student } from 'src/entities/students.entity';
// import type { Cache } from 'cache-manager';
// import { User, UserRole } from 'src/entities/user.entity';
// import * as ExcelJS from 'exceljs';
// import * as express from 'express';
// import { SalaryService } from 'src/salarys/salary.service';

// @Injectable()
// export class ReportsService {
//   constructor(
//     @InjectRepository(Student) private studentRepo: Repository<Student>,
//     @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
//     @InjectRepository(Group) private groupRepo: Repository<Group>,
//     @InjectRepository(User) private userRepo: Repository<User>,
//     private salaryService: SalaryService,
//     @InjectRepository(Attendance)
//     private attendanceRepo: Repository<Attendance>,
//     @Inject(CACHE_MANAGER) private cacheManager: Cache,
//   ) {}

//   /**
//    * 1. MOLIYAVIY TAHLIL (Redis Kesh bilan)
//    */
//   async getFinancialOverview(startDate: Date, endDate: Date) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     // 1. Redis Keshni tekshirish
//     const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}`;
//     const cached = await this.cacheManager.get(cacheKey);
//     if (cached) return cached;

//     // 2. To'lovlar va qarzni hisoblash
//     const paymentsData = await this.paymentRepo
//       .createQueryBuilder('p')
//       .leftJoinAndSelect('p.group', 'g')
//       .where('p.createdAt BETWEEN :start AND :end', { start, end })
//       .getMany();

//     const totalIncome = paymentsData.reduce(
//       (sum, p) => sum + Number(p.amount),
//       0,
//     );

//     const totalPending = paymentsData.reduce((sum, p) => {
//       const coursePrice = Number(p.group?.price || 0);
//       const paidAmount = Number(p.amount);
//       const debt = coursePrice > paidAmount ? coursePrice - paidAmount : 0;
//       return sum + debt;
//     }, 0);

//     // 3. O'qituvchilar oyligini optimallashtirilgan (Parallel) hisoblash
//     const teachers = await this.userRepo.find({
//       where: { role: UserRole.TEACHER },
//     });

//     const monthString = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

//     // Har bir o'qituvchi uchun so'rovlarni parallel yuboramiz
//     const salaryPromises = teachers.map(
//       (teacher) =>
//         this.salaryService
//           .calculateTeacherSalary(teacher.id, monthString)
//           .catch(() => ({ totalSalary: 0 })), // Maoshi belgilanmagan bo'lsa xatolikni ushlab 0 qaytaradi
//     );

//     const salaryResults = await Promise.all(salaryPromises);

//     // Jami oylik xarajatini yig'amiz
//     const totalTeacherSalaries = salaryResults.reduce(
//       (sum, res) => sum + (res.totalSalary || 0),
//       0,
//     );

//     // 4. SOF FOYDA (Net Profit)
//     // Formula: Jami daromad - O'qituvchilar oyligi
//     const netProfit = totalIncome - totalTeacherSalaries;

//     const result = {
//       totalIncome, // Jami tushgan naqd pul
//       totalPending, // Hali tushmagan qarzlar
//       totalTeacherSalaries, // O'qituvchilarga berilishi kerak bo'lgan jami oylik
//       netProfit, // Sof foyda (Haqiqiy foyda)
//       currency: "so'm",
//       generatedAt: new Date(),
//       period: {
//         from: start,
//         to: end,
//       },
//     };

//     // 5. Natijani Redis-ga yozish (15 minutga)
//     await this.cacheManager.set(cacheKey, result, 300000);

//     return result;
//   }

//   /**
//    * 2. QARZDORLAR RO'YXATI (Excel Export bilan)
//    */
//   async exportDebtorsToExcel(res: express.Response) {
//     const paymentsWithDebt = await this.paymentRepo
//       .createQueryBuilder('payment')
//       .leftJoinAndSelect('payment.student', 'student')
//       .leftJoinAndSelect('payment.group', 'group')
//       .select(['payment', 'student', 'group'])
//       .addSelect('(group.price - payment.amount)', 'calculated_debt')
//       .where('group.price > payment.amount')
//       .orderBy('payment.createdAt', 'DESC')
//       .getRawAndEntities();

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Qarzdorlar');

//     worksheet.columns = [
//       { header: 'Talaba F.I.SH', key: 'fullName', width: 30 },
//       { header: 'Telefon', key: 'phone', width: 20 },
//       { header: 'Guruh', key: 'groupName', width: 20 },
//       { header: 'Kurs Narxi', key: 'coursePrice', width: 15 },
//       { header: "To'langan Summa", key: 'paidAmount', width: 15 },
//       { header: 'Qarz Miqdori', key: 'debt', width: 15 },
//       { header: 'Toʻlov Sanasi', key: 'date', width: 15 },
//     ];

//     worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
//     worksheet.getRow(1).fill = {
//       type: 'pattern',
//       pattern: 'solid',
//       fgColor: { argb: 'C0392B' },
//     };

//     paymentsWithDebt.entities.forEach((payment, index) => {
//       const rawData = paymentsWithDebt.raw[index];
//       const debtValue = Number(rawData.calculated_debt);

//       // Sanani formatlash
//       const pDate = new Date(payment.paymentDate);
//       // 'en-GB' -> 26/02/2026 formatini beradi
//       const formattedDate = pDate.toLocaleDateString('en-GB');

//       worksheet.addRow({
//         fullName: payment.student?.fullName || 'Nomaʼlum',
//         phone: payment.student?.phone || '-',
//         groupName: payment.group?.name || 'Guruhsiz',
//         coursePrice: `${Number(payment.group?.price || 0).toLocaleString()} so'm`,
//         paidAmount: `${Number(payment.amount).toLocaleString()} so'm`,
//         debt: `${debtValue.toLocaleString()} so'm`,
//         date: formattedDate, // To'g'rilangan sana
//       });
//     });

//     const fileName = `Qarzdorlar_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
//     res.setHeader(
//       'Content-Type',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//     );
//     res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

//     await workbook.xlsx.write(res);
//     res.end();
//   }

//   /**
//    * 4. O'QITUVCHILAR SAMARADORLIGI (QueryBuilder bilan optimallashgan)
//    */
//   async getTeacherPerformance(startDate: Date, endDate: Date) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     const data = await this.groupRepo
//       .createQueryBuilder('g')
//       .leftJoin('g.teacher', 't')
//       .leftJoin('g.attendances', 'a')
//       .select([
//         't.id as teacher_id',
//         't.fullName as teacher_name',
//         'g.id as group_id',
//         'g.name as group_name',
//         'COUNT(DISTINCT a.date) as total_lessons',
//         'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as attended_count',
//       ])
//       .where('a.date BETWEEN :start AND :end', { start, end })
//       .groupBy('t.id, t.fullName, g.id, g.name')
//       .getRawMany();

//     const result = await Promise.all(
//       data.map(async (item) => {
//         // MUHIM: 'enrolledGroups' deb nomlangan relationni ishlatamiz
//         // Agar entity-da boshqacha bo'lsa, o'sha nomni qo'ying (masalan: students)
//         const studentCount = await this.studentRepo
//           .createQueryBuilder('student')
//           .leftJoin('student.enrolledGroups', 'group') // Bog'liqlik nomi: enrolledGroups
//           .where('group.id = :groupId', { groupId: item.group_id })
//           .getCount();

//         const totalLessons = Number(item.total_lessons) || 0;
//         const attendedCount = Number(item.attended_count) || 0;

//         // To'g'ri formula: Jami darslar * Guruhdagi talabalar soni
//         const shouldAttend = totalLessons * studentCount;

//         const attendanceRate =
//           shouldAttend > 0
//             ? Math.round((attendedCount / shouldAttend) * 100)
//             : 0;

//         return {
//           teacherId: item.teacher_id,
//           teacherName: item.teacher_name,
//           groupName: item.group_name,
//           totalLessons,
//           totalStudents: studentCount,
//           shouldAttend,
//           attendedCount,
//           attendanceRate: attendanceRate > 100 ? 100 : attendanceRate,
//         };
//       }),
//     );
//     const dynamicCacheKey = `teacher_performance_${start.getTime()}_${end.getTime()}`;
//     await this.cacheManager.set(dynamicCacheKey, result, 300000);
//     return result;
//   }
// }

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { Student } from 'src/entities/students.entity';
import type { Cache } from 'cache-manager';
import { User, UserRole } from 'src/entities/user.entity';
import * as ExcelJS from 'exceljs';
import * as express from 'express';
import { SalaryService } from 'src/salarys/salary.service';

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
  // async getFinancialOverview(startDate: Date, endDate: Date) {
  //   const start = new Date(startDate);
  //   start.setHours(0, 0, 0, 0);
  //   const end = new Date(endDate);
  //   end.setHours(23, 59, 59, 999);

  //   const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}`;

  //   const cached = await this.cacheManager.get(cacheKey);
  //   if (cached) return cached;

  //   const paymentsData = await this.paymentRepo
  //     .createQueryBuilder('p')
  //     .leftJoinAndSelect('p.group', 'g')
  //     .leftJoinAndSelect('p.student', 's')
  //     .where('p.createdAt BETWEEN :start AND :end', { start, end })
  //     .getMany();

  //   const totalIncome = paymentsData.reduce(
  //     (sum, p) => sum + Number(p.amount || 0),
  //     0,
  //   );

  //   // ✅ student+group kombinatsiyasi bo'yicha qarz hisoblash
  //   const studentGroupMap = new Map<string,{ totalPaid: number; groupPrice: number }>();

  //   for (const p of paymentsData) {
  //     const studentId = p.student?.id;
  //     const groupId = p.group?.id;
  //     if (!studentId || !groupId) continue;

  //     const key = `${studentId}_${groupId}`;
  //     const groupPrice = Number(p.group?.price || 0);
  //     const paidAmount = Number(p.amount || 0);

  //     if (!studentGroupMap.has(key)) {
  //       studentGroupMap.set(key, { totalPaid: 0, groupPrice });
  //     }
  //     studentGroupMap.get(key)!.totalPaid += paidAmount;
  //   }

  //   let totalPending = 0;
  //   for (const [, { totalPaid, groupPrice }] of studentGroupMap) {
  //     if (groupPrice > totalPaid) {
  //       totalPending += groupPrice - totalPaid;
  //     }
  //   }

  //   // ✅ O'qituvchilar oyligi — startDate va endDate bilan
  //   const teachers = await this.userRepo.find({
  //     where: { role: UserRole.TEACHER },
  //   });

  //   const startStr = start.toISOString().split('T')[0]; // "2026-02-01"
  //   const endStr = end.toISOString().split('T')[0]; // "2026-02-28"

  //   const salaryResults = await Promise.all(
  //     teachers.map((teacher) =>
  //       this.salaryService
  //         .calculateTeacherSalary(
  //           teacher.id,
  //           startStr, // ✅ startDate
  //           endStr, // ✅ endDate
  //         )
  //         .catch(() => ({ totalSalary: 0 })),
  //     ),
  //   );

  //   const totalTeacherSalaries = salaryResults.reduce(
  //     (sum, res) => sum + (res?.totalSalary || 0),
  //     0,
  //   );

  //   const netProfit = totalIncome - totalTeacherSalaries;

  //   const result = {
  //     totalIncome,
  //     totalPending,
  //     totalTeacherSalaries,
  //     netProfit,
  //     currency: "so'm",
  //     generatedAt: new Date(),
  //     period: { from: start, to: end },
  //   };

  //   await this.cacheManager.set(cacheKey, result, CACHE_TTL);
  //   return result;
  // }

async getFinancialOverview(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}`;

  try {
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  // ✅ 1. Sana oralig'idagi daromad
  const paymentsData = await this.paymentRepo
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.group', 'g')
    .leftJoinAndSelect('p.student', 's')
    .where('p.createdAt BETWEEN :start AND :end', { start, end })
    .getMany();

  const totalIncome = paymentsData.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0,
  );

  // ✅ 2. BARCHA talabalarning umumiy qarzi
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
      // ✅ Discount bor bo'lsa customPrice, yo'q bo'lsa group.price
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

  // ✅ 3. O'qituvchilar oyligi
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
    totalIncome,         // ✅ Sana oralig'idagi daromad
    totalPending,        // ✅ BARCHA talabalarning umumiy qarzi
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
    const rawDebts = await this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoin('payment.student', 'student')
      .leftJoin('payment.group', 'group')
      .select([
        'student.id                          AS "studentId"',
        'student.fullName                    AS "fullName"',
        'student.phone                       AS "phone"',
        'group.id                            AS "groupId"',
        'group.name                          AS "groupName"',
        'CAST(group.price AS DECIMAL)        AS "groupPrice"',
        'SUM(CAST(payment.amount AS DECIMAL)) AS "totalPaid"',
      ])
      .groupBy(
        'student.id, student.fullName, student.phone, group.id, group.name, group.price',
      )
      .having(
        'CAST(group.price AS DECIMAL) > SUM(CAST(payment.amount AS DECIMAL))',
      )
      .orderBy('"fullName"', 'ASC')
      .getRawMany();

    // DEBUG — birinchi ishlatganda log qil, keyin o'chir

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

    // Header styling
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

    // JAMI qator
    const totalRow = worksheet.addRow({
      index: '',
      fullName: 'JAMI QARZ:',
      phone: '',
      groupName: '',
      coursePrice: '',
      paidAmount: '',
      debt: `${totalDebt.toLocaleString()} so'm`,
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F9EBEA' },
    };

    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `Qarzdorlar_${today}.xlsx`;

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
