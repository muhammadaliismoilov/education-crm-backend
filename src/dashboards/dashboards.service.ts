import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getSummary(startDate: Date, endDate: Date) {
    const cacheKey = `dashboard_summary_${startDate.getTime()}_${endDate.getTime()}`;

    try {
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) return cachedData;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    const [incomeRes, debtRes, activeStudents, newStudents, attendance, activeGroups] =
      await Promise.all([
        // Jami daromad (davr ichida)
        this.paymentRepo
          .createQueryBuilder('p')
          .select('SUM(p.amount)', 'total')
          .where('p.createdAt BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .getRawOne(),

        // ✅ Jami qarzdorlik — student.balance < 0 (haqiqiy joriy qarz)
        // Bu eng aniq ma'lumot: har bir to'lov amalga oshirilganda balance yangilanadi
        this.studentRepo
          .createQueryBuilder('s')
          .select('SUM(s.balance)', 'totalDebt')
          .where('s.balance < 0')
          .andWhere('s.deletedAt IS NULL')
          .getRawOne(),

        // Faol talabalar (jami)
        this.studentRepo.count(),

        // Yangi talabalar (davr ichida)
        this.studentRepo.countBy({
          createdAt: Between(startDate, endDate),
        }),

        // Davomat foizi
        this.attendanceRepo
          .createQueryBuilder('a')
          .select([
            'COUNT(a.id) as total',
            'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as present',
          ])
          .where('a.createdAt BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .getRawOne(),

        // Faol guruhlar
        this.groupRepo.countBy({ isActive: true }),
      ]);

    const result = {
      totalIncome: Number(incomeRes?.total) || 0,
      // Math.abs: manfiy sonni musbatga aylantirish (masalan: -1950000 → 1950000)
      totalPending: Math.abs(Number(debtRes?.totalDebt) || 0),
      activeStudents,
      newStudents,
      attendancePercent:
        attendance?.total > 0
          ? Math.round(
              (Number(attendance.present) / Number(attendance.total)) * 100,
            )
          : 0,
      activeGroups,
      currency: "so'm",
      calculatedAt: new Date(),
    };

    try {
      await this.cacheManager.set(cacheKey, result, 60000); // 1 daqiqa
    } catch (e) {
      this.logger.warn(`Cache set xatolik [${cacheKey}]: ${e.message}`);
    }

    return result;
  }
}