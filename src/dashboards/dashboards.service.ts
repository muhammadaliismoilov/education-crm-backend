import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Student } from '../entities/students.entity';
import { Payment } from '../entities/payment.entity';
import { Group } from '../entities/group.entity';
import { Attendance } from '../entities/attendance.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { User, UserRole } from '../entities/user.entity';
import { SalaryService } from '../salarys/salary.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly expensesService: ExpensesService,
    private readonly salaryService: SalaryService,
  ) {}

  async getSummary(
    startDate: Date,
    endDate: Date,
    user?: any,
    branchIdFilter?: string,
  ) {
    const isManager = user?.role === UserRole.MANAGER;
    const isSuperadmin = user?.role === UserRole.SUPERADMIN;

    let branchId: string | null = null;
    if (!isSuperadmin && user) {
      branchId = user.branchId;
    } else if (branchIdFilter) {
      branchId = branchIdFilter;
    }

    const cacheKey = `dashboard_summary_${startDate.getTime()}_${endDate.getTime()}_${branchId || 'all'}_${user?.role || 'anon'}`;

    try {
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) return cachedData;
    } catch (e) {
      this.logger.warn(`Cache get xatolik [${cacheKey}]: ${e.message}`);
    }

    // Davomat statistikasi
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

    // Faol talabalar soni
    const activeStudentsQuery = this.studentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL');
    if (branchId)
      activeStudentsQuery.andWhere('s.branchId = :branchId', { branchId });

    // Yangi talabalar soni (sana oralig'ida)
    const newStudentsQuery = this.studentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    if (branchId)
      newStudentsQuery.andWhere('s.branchId = :branchId', { branchId });

    // Qarzdorlik hisoblash
    const studentDebtQuery = this.studentRepo
      .createQueryBuilder('s')
      .select('SUM(s.balance)', 'totalDebt')
      .where('s.balance < 0')
      .andWhere('s.deletedAt IS NULL');
    if (branchId)
      studentDebtQuery.andWhere('s.branchId = :branchId', { branchId });

    // Faol guruhlar
    const groupsQuery = this.groupRepo
      .createQueryBuilder('g')
      .where('g.isActive = true');
    if (branchId) groupsQuery.andWhere('g.branchId = :branchId', { branchId });

    // Parallelda barchani hisoblash
    const promises: Promise<any>[] = [
      studentDebtQuery.getRawOne(),
      activeStudentsQuery.getCount(),
      newStudentsQuery.getCount(),
      attendanceQuery.getRawOne(),
      groupsQuery.getCount(),
      this.expensesService.getTotalExpenses(startDate, endDate, branchId),
    ];

    // MANAGER bo'lmagan rol uchun kirim ham hisoblanadi
    let incomePromise: Promise<any> | null = null;
    if (!isManager) {
      const paymentQuery = this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.createdAt BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        });
      if (branchId)
        paymentQuery.andWhere('p.branchId = :branchId', { branchId });
      incomePromise = paymentQuery.getRawOne();
    }

    const [
      debtRes,
      activeStudents,
      newStudents,
      attendance,
      activeGroups,
      totalExpenses,
    ] = await Promise.all(promises);

    const incomeRes = incomePromise ? await incomePromise : null;
    const totalIncome = Number(incomeRes?.total) || 0;
    const totalDebt = Math.abs(Number(debtRes?.totalDebt) || 0);

    // O'qituvchilar oyligini hisoblash
    let totalTeacherSalaries = 0;
    if (!isManager) {
      const teacherQuery: any = { role: UserRole.TEACHER };
      if (branchId) teacherQuery.branch = { id: branchId };
      const teachers = await this.userRepo.find({ where: teacherQuery });
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      const salaryResults = await Promise.all(
        teachers.map((t) =>
          this.salaryService
            .calculateTeacherSalary(t.id, startStr, endStr)
            .catch(() => ({ totalSalary: 0 }))
        )
      );
      totalTeacherSalaries = salaryResults.reduce(
        (sum, res) => sum + (res?.totalSalary || 0),
        0
      );
    }

    const profit = isManager ? null : totalIncome - totalExpenses - totalTeacherSalaries;

    // MANAGER uchun kirim ma'lumotlari yashiriladi
    const result = {
      ...(isManager ? {} : { totalIncome, profit }),
      totalExpenses,
      totalTeacherSalaries,
      totalPending: totalDebt,
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
