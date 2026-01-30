import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from 'src/entities/user.entity';
import { Between, Repository } from 'typeorm';

@Injectable()
export class StatsService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async getYearlyStats(year: number) {
    const stats: { month: string; arrived: number; left: number }[] = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);

      const arrived = await this.userRepo.count({
        where: {
          role: UserRole.STUDENT,
          createdAt: Between(startDate, endDate),
        },
      });

      const left = await this.userRepo.count({
        where: {
          role: UserRole.STUDENT,
          isActive: false,
          updatedAt: Between(startDate, endDate),
        },
      });

      stats.push({
        month: startDate.toLocaleString('uz', { month: 'long' }),
        arrived,
        left,
      });
    }

    return stats;
  }
}
