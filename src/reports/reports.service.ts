import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { Student } from 'src/entities/students.entity';
import type { Cache } from 'cache-manager';
import * as ExcelJS from 'exceljs';
import * as express from 'express';
import { MoreThan } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 1. MOLIYAVIY TAHLIL (Redis Kesh bilan)
   */
  async getFinancialOverview(startDate: Date, endDate: Date) {
    const cacheKey = `finance_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const payments = await this.paymentRepo.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const studentsWithDebt = await this.studentRepo.find({
      where: { balance: Between(-100000000, -1) },
    });
    const totalPending = Math.abs(
      studentsWithDebt.reduce((sum, s) => sum + Number(s.balance), 0),
    );

    const result = {
      totalIncome,
      totalPending,
      currency: "so'm",
      generatedAt: new Date(),
    };

    // 15 daqiqa keshga saqlash
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
  async getGrowthReport(startDate: Date, endDate: Date) {
    const cacheKey = `growth_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [newStudents, leftStudents] = await Promise.all([
      this.studentRepo.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.studentRepo.count({
        where: { deletedAt: Between(startDate, endDate) },
        withDeleted: true,
      }),
    ]);

    const result = {
      newStudents,
      leftStudents,
      netGrowth: newStudents - leftStudents,
    };
    await this.cacheManager.set(cacheKey, result, 900000);
    return result;
  }

  /**
   * 4. O'QITUVCHILAR SAMARADORLIGI (QueryBuilder bilan optimallashgan)
   */
  async getTeacherPerformance() {
    const cacheKey = 'teacher_performance';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.teacher', 't')
      .leftJoin('g.attendances', 'a')
      .select([
        't.fullName as teacherName',
        'g.name as groupName',
        'COUNT(a.id) as totalLessons',
        'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as attendedLessons',
      ])
      .groupBy('t.id, t.fullName, g.id, g.name')
      .getRawMany();

    const result = data.map((item) => ({
      ...item,
      attendanceRate:
        item.totalLessons > 0
          ? Math.round((item.attendedLessons / item.totalLessons) * 100)
          : 0,
    }));

    await this.cacheManager.set(cacheKey, result, 3600000); // 1 soat kesh
    return result;
  }

  /**
   * 5. GURUHLAR ANALITIKASI
   */
  async getGroupAnalytics() {
    return this.groupRepo
      .createQueryBuilder('g')
      .loadRelationCountAndMap('g.studentCount', 'g.students')
      .getMany();
  }
}
