import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SalaryPayout } from 'src/entities/salaryPayout.entity';
import { User, UserRole } from 'src/entities/user.entity';
import { Repository } from 'typeorm';


@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(User) 
    private userRepo: Repository<User>,
    @InjectRepository(SalaryPayout) 
    private payoutRepo: Repository<SalaryPayout>,
  ) {}

  // 1. Oylikni hisoblash mantiqi (Virtual)
  async getTeacherSalary(teacherId: string) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
      relations: ['teachingGroups', 'teachingGroups.students']
    });

    if (!teacher) {
      throw new NotFoundException('O\'qituvchi topilmadi');
    }

    let totalEarned = 0;
    const details = teacher.teachingGroups.map(group => {
      const income = (group.students?.length || 0) * (group.price || 0);
      const share = (income * (teacher.salaryPercentage || 0)) / 100;
      totalEarned += share;
      
      return {
        groupName: group.name,
        students: group.students?.length || 0,
        groupIncome: income,
        teacherShare: share
      };
    });

    return {
      teacherName: teacher.fullName,
      totalSalary: totalEarned,
      breakdown: details
    };
  }

  // 2. Oylikni to'lash va bazaga saqlash
  async payTeacherSalary(teacherId: string, month: string) {
    // Avval hisoblaymiz
    const salaryInfo = await this.getTeacherSalary(teacherId);

    // Tekshiruv: Shu oy uchun to'langanmi?
    const existing = await this.payoutRepo.findOne({
      where: { teacher: { id: teacherId }, forMonth: month }
    });

    if (existing) {
      throw new BadRequestException(`${month} oyi uchun oylik allaqachon to'langan!`);
    }

    // Bazaga saqlash
    const newPayout = this.payoutRepo.create({
      amount: salaryInfo.totalSalary,
      forMonth: month,
      teacher: { id: teacherId }
    });

    return await this.payoutRepo.save(newPayout);
  }

  // 3. To'lovlar tarixini olish
  async getPayoutHistory(teacherId?: string) {
    const query = this.payoutRepo.createQueryBuilder('payout')
      .leftJoinAndSelect('payout.teacher', 'teacher')
      .orderBy('payout.paidAt', 'DESC');

    if (teacherId) {
      query.where('teacher.id = :teacherId', { teacherId });
    }

    return await query.getMany();
  }
}