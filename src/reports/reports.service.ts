import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER, CacheKey } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { Student } from 'src/entities/students.entity';
import type { Cache } from 'cache-manager';
import { User, UserRole } from 'src/entities/user.entity';
import * as ExcelJS from 'exceljs';
import * as express from 'express';
import { SalaryService } from 'src/salarys/salary.service';

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

  /**
   * 1. MOLIYAVIY TAHLIL (Redis Kesh bilan)
   */
  async getFinancialOverview(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // 1. Redis Keshni tekshirish
  const cacheKey = `finance_overview_${start.getTime()}_${end.getTime()}`;
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;

  // 2. To'lovlar va qarzni hisoblash
  const paymentsData = await this.paymentRepo
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.group', 'g')
    .where('p.createdAt BETWEEN :start AND :end', { start, end })
    .getMany();

  const totalIncome = paymentsData.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  const totalPending = paymentsData.reduce((sum, p) => {
    const coursePrice = Number(p.group?.price || 0);
    const paidAmount = Number(p.amount);
    const debt = coursePrice > paidAmount ? coursePrice - paidAmount : 0;
    return sum + debt;
  }, 0);

  // 3. O'qituvchilar oyligini optimallashtirilgan (Parallel) hisoblash
  const teachers = await this.userRepo.find({
    where: { role: UserRole.TEACHER },
  });

  const monthString = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  // Har bir o'qituvchi uchun so'rovlarni parallel yuboramiz
  const salaryPromises = teachers.map(teacher => 
    this.salaryService.calculateTeacherSalary(teacher.id, monthString)
      .catch(() => ({ totalSalary: 0 })) // Maoshi belgilanmagan bo'lsa xatolikni ushlab 0 qaytaradi
  );

  const salaryResults = await Promise.all(salaryPromises);
  
  // Jami oylik xarajatini yig'amiz
  const totalTeacherSalaries = salaryResults.reduce(
    (sum, res) => sum + (res.totalSalary || 0), 
    0
  );

  // 4. SOF FOYDA (Net Profit)
  // Formula: Jami daromad - O'qituvchilar oyligi
  const netProfit = totalIncome - totalTeacherSalaries;

  const result = {
    totalIncome,          // Jami tushgan naqd pul
    totalPending,         // Hali tushmagan qarzlar
    totalTeacherSalaries, // O'qituvchilarga berilishi kerak bo'lgan jami oylik
    netProfit,            // Sof foyda (Haqiqiy foyda)
    currency: "so'm",
    generatedAt: new Date(),
    period: {
      from: start,
      to: end
    }
  };

  // 5. Natijani Redis-ga yozish (15 minutga)
  await this.cacheManager.set(cacheKey, result, 900000);

  return result;
}


  /**
   * 2. QARZDORLAR RO'YXATI (Excel Export bilan)
   */
  async exportDebtorsToExcel(res: express.Response) {
    // 1. QueryBuilder yordamida guruh narxi va to'langan summa farqini hisoblaymiz
    const paymentsWithDebt = await this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.student', 'student')
      .leftJoinAndSelect('payment.group', 'group')
      .select([
        'payment', // To'lovning barcha ustunlari
        'student', // Talaba ma'lumotlari
        'group', // Guruh ma'lumotlari
      ])
      // Virtual ustun: qarz = guruh narxi - to'langan summa
      .addSelect('(group.price - payment.amount)', 'calculated_debt')
      .where('group.price > payment.amount') // Faqat kurs narxidan kam to'langanlar
      .orderBy('payment.createdAt', 'DESC')
      .getRawAndEntities();
    // getRawAndEntities — ham entity'larni, ham hisoblangan 'calculated_debt'ni olish uchun

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Qarzdorlar');

    // 2. Excel sarlavhalari
    worksheet.columns = [
      { header: 'Talaba F.I.SH', key: 'fullName', width: 30 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Guruh', key: 'groupName', width: 20 },
      { header: 'Kurs Narxi', key: 'coursePrice', width: 15 },
      { header: "To'langan Summa", key: 'paidAmount', width: 15 },
      { header: 'Qarz Miqdori', key: 'debt', width: 15 },
      { header: 'Toʻlov Sanasi', key: 'date', width: 15 },
    ];

    // Sarlavha dizayni
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'C0392B' }, // To'q qizil (Qarzdorlar uchun)
    };

    // 3. Ma'lumotlarni Excelga yozish
    // getRawAndEntities bizga entities (massiv) va raw (massiv) qaytaradi
    paymentsWithDebt.entities.forEach((payment, index) => {
      // Har bir entityga mos keladigan raw ma'lumotdan hisoblangan qarzni olamiz
      const rawData = paymentsWithDebt.raw[index];
      const debtValue = Number(rawData.calculated_debt);

      worksheet.addRow({
        fullName: payment.student?.fullName || 'Nomaʼlum',
        phone: payment.student?.phone || '-',
        groupName: payment.group?.name || 'Guruhsiz',
        coursePrice: `${Number(payment.group?.price || 0).toLocaleString()} so'm`,
        paidAmount: `${Number(payment.amount).toLocaleString()} so'm`,
        debt: `${debtValue.toLocaleString()} so'm`,
        date: new Date(payment.paymentDate).toLocaleDateString(),
      });
    });

    // 4. Faylni yuborish
    const fileName = `Qarzdorlar_Hisoboti_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * 3. TALABALAR DINAMIKASI (Kesh bilan)
   */
  // async getGrowthReport(startDate: Date, endDate: Date) {
  //   const cacheKey = `growth_${startDate.getTime()}_${endDate.getTime()}`;
  //   const cached = await this.cacheManager.get(cacheKey);
  //   if (cached) return cached;

  //   const [newStudents, leftStudents] = await Promise.all([
  //     this.studentRepo.count({
  //       where: { createdAt: Between(startDate, endDate) },
  //     }),
  //     this.studentRepo.count({
  //       where: { deletedAt: Between(startDate, endDate) },
  //       withDeleted: true,
  //     }),
  //   ]);

  //   const result = {
  //     newStudents,
  //     leftStudents,
  //     netGrowth: newStudents - leftStudents,
  //   };
  //   await this.cacheManager.set(cacheKey, result, 60);
  //   return result;
  // }

  /**
   * 4. O'QITUVCHILAR SAMARADORLIGI (QueryBuilder bilan optimallashgan)
   */
  async getTeacherPerformance(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const data = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoin('g.teacher', 't')
      .leftJoin('g.attendances', 'a')
      .select([
        't.id as teacher_id',
        't.fullName as teacher_name',
        'g.id as group_id',
        'g.name as group_name',
        'COUNT(DISTINCT a.date) as total_lessons',
        'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as attended_count',
      ])
      .where('a.date BETWEEN :start AND :end', { start, end })
      .groupBy('t.id, t.fullName, g.id, g.name')
      .getRawMany();

    const result = await Promise.all(
      data.map(async (item) => {
        // MUHIM: 'enrolledGroups' deb nomlangan relationni ishlatamiz
        // Agar entity-da boshqacha bo'lsa, o'sha nomni qo'ying (masalan: students)
        const studentCount = await this.studentRepo
          .createQueryBuilder('student')
          .leftJoin('student.enrolledGroups', 'group') // Bog'liqlik nomi: enrolledGroups
          .where('group.id = :groupId', { groupId: item.group_id })
          .getCount();

        const totalLessons = Number(item.total_lessons) || 0;
        const attendedCount = Number(item.attended_count) || 0;

        // To'g'ri formula: Jami darslar * Guruhdagi talabalar soni
        const shouldAttend = totalLessons * studentCount;

        const attendanceRate =
          shouldAttend > 0
            ? Math.round((attendedCount / shouldAttend) * 100)
            : 0;

        return {
          teacherId: item.teacher_id,
          teacherName: item.teacher_name,
          groupName: item.group_name,
          totalLessons,
          totalStudents: studentCount,
          shouldAttend,
          attendedCount,
          attendanceRate: attendanceRate > 100 ? 100 : attendanceRate,
        };
      }),
    );
    const dynamicCacheKey = `teacher_performance_${start.getTime()}_${end.getTime()}`;
    await this.cacheManager.set(dynamicCacheKey, result, 900000);
    return result;
  }
}
