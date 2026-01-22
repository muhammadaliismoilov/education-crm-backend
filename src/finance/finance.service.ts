import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from 'src/entities/user.entity';

import { Repository } from 'typeorm';

@Injectable()
export class FinanceService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async getTeacherSalary(teacherId: string) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
      relations: ['teachingGroups', 'teachingGroups.students']
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    let totalEarned = 0;
    const groupDetails = teacher.teachingGroups.map(group => {
      const income = group.students.length * group.price;
      const share = (income * teacher.salaryPercentage) / 100;
      totalEarned += share;
      return { group: group.name, income, teacherShare: share };
    });

    return { total: totalEarned, breakdown: groupDetails };
  }
}