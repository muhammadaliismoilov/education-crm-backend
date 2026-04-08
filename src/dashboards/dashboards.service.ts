import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async getSummary(
    startDate: Date,
    endDate: Date,
    user?: any,
    branchIdFilter?: string,
  ) {
    let branchId = null;
    if (user && user.role !== 'superadmin') {
      branchId = user.branchId;
    } else if (branchIdFilter) {
      branchId = branchIdFilter;
    }

    const cacheKey = `dashboard_summary_${startDate.getTime()}_${endDate.getTime()}_${branchId || 'all'}`;

    try {
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) return cachedData;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    const paymentQuery = this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    if (branchId) paymentQuery.andWhere('p.branchId = :branchId', { branchId });

    const studentDebtQuery = this.studentRepo
      .createQueryBuilder('s')
      .select('SUM(s.balance)', 'totalDebt')
      .where('s.balance < 0')
      .andWhere('s.deletedAt IS NULL');
    if (branchId)
      studentDebtQuery.andWhere('s.branchId = :branchId', { branchId });

    const activeStudentsQuery = this.studentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL');
    if (branchId)
      activeStudentsQuery.andWhere('s.branchId = :branchId', { branchId });

    const newStudentsQuery = this.studentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    if (branchId)
      newStudentsQuery.andWhere('s.branchId = :branchId', { branchId });

    const attendanceQuery = this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'COUNT(a.id) as total',
        'SUM(CASE WHEN a.isPresent = true THEN 1 ELSE 0 END) as present',
      ])
      .where('a.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    if (branchId)
      attendanceQuery.andWhere('a.branchId = :branchId', { branchId });

    const groupsQuery = this.groupRepo
      .createQueryBuilder('g')
      .where('g.isActive = true');
    if (branchId) groupsQuery.andWhere('g.branchId = :branchId', { branchId });

    const [
      incomeRes,
      debtRes,
      activeStudents,
      newStudents,
      attendance,
      activeGroups,
    ] = await Promise.all([
      paymentQuery.getRawOne(),
      studentDebtQuery.getRawOne(),
      activeStudentsQuery.getCount(),
      newStudentsQuery.getCount(),
      attendanceQuery.getRawOne(),
      groupsQuery.getCount(),
    ]);

    const result = {
      totalIncome: Number(incomeRes?.total) || 0,
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
