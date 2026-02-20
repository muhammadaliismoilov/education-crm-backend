import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Student } from 'src/entities/students.entity';
import { Payment } from 'src/entities/payment.entity';
import { Group } from 'src/entities/group.entity';
import { Attendance } from 'src/entities/attendance.entity';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getSummary(startDate: Date, endDate: Date) {
    const cacheKey = `dashboard_summary_${startDate.getTime()}_${endDate.getTime()}`;
    
    // 1. Keshni tekshirish (Redis orqali)
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.logger.log('Returning dashboard data from cache');
      return cachedData;
    }

    this.logger.log('Calculating fresh dashboard data...');

    // 2. Barcha so'rovlarni Parallel yuborish (High Performance)
    const [incomeRes, debtRes, activeStudents, newStudents, attendance, activeGroups] = await Promise.all([
      // Jami daromad
      this.paymentRepo.createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),

      // Jami qarzdorlik
      this.studentRepo.createQueryBuilder('s')
        .select('SUM(s.balance)', 'totalDebt')
        .where('s.balance < 0')
        .getRawOne(),

      // Jami faol talabalar
      this.studentRepo.count(),

      // Yangi talabalar (TypeORM Between operatori bilan)
      this.studentRepo.countBy({
        createdAt: Between(startDate, endDate)
      }),

      // Davomat foizi (Bitwise emas, Case when orqali)
      this.attendanceRepo.createQueryBuilder('a')
        .select([
          'COUNT(a.id) as total',
          'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as present'
        ])
        .where('a.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),

      // Faol guruhlar
      this.groupRepo.countBy({ isActive: true })
    ]);

    // 3. Ma'lumotlarni formatlash
    const result = {
      totalIncome: Number(incomeRes?.total) || 0,
      totalPending: Math.abs(Number(debtRes?.totalDebt)) || 0,
      activeStudents,
      newStudents,
      attendancePercent: attendance?.total > 0 
        ? Math.round((Number(attendance.present) / Number(attendance.total)) * 100) 
        : 0,
      activeGroups,
      currency: "so'm",
      calculatedAt: new Date()
    };

    // 4. Natijani Redisga 10 minutga keshlaymiz
    await this.cacheManager.set(cacheKey, result, 600000); 

    return result;
  }
}