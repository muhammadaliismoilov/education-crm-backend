// import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { SalaryPayout } from 'src/entities/salaryPayout.entity';
// import { User, UserRole } from 'src/entities/user.entity';
// import { Repository } from 'typeorm';


// @Injectable()
// export class FinanceService {
//   constructor(
//     @InjectRepository(User) 
//     private userRepo: Repository<User>,
//     @InjectRepository(SalaryPayout) 
//     private payoutRepo: Repository<SalaryPayout>,
//   ) {}

//   // 1. Oylikni hisoblash mantiqi (Virtual)
//   async getTeacherSalary(teacherId: string) {
//     const teacher = await this.userRepo.findOne({
//       where: { id: teacherId, role: UserRole.TEACHER },
//       relations: ['teachingGroups', 'teachingGroups.students']
//     });

//     if (!teacher) {
//       throw new NotFoundException('O\'qituvchi topilmadi');
//     }

//     let totalEarned = 0;
//     const details = teacher.teachingGroups.map(group => {
//       const income = (group.students?.length || 0) * (group.price || 0);
//       const share = (income * (teacher.salaryPercentage || 0)) / 100;
//       totalEarned += share;
      
//       return {
//         groupName: group.name,
//         students: group.students?.length || 0,
//         groupIncome: income,
//         teacherShare: share
//       };
//     });

//     return {
//       teacherName: teacher.fullName,
//       totalSalary: totalEarned,
//       breakdown: details
//     };
//   }

//   // 2. Oylikni to'lash va bazaga saqlash
//   async payTeacherSalary(teacherId: string, month: string) {
//     // Avval hisoblaymiz
//     const salaryInfo = await this.getTeacherSalary(teacherId);

//     // Tekshiruv: Shu oy uchun to'langanmi?
//     const existing = await this.payoutRepo.findOne({
//       where: { teacher: { id: teacherId }, forMonth: month }
//     });

//     if (existing) {
//       throw new BadRequestException(`${month} oyi uchun oylik allaqachon to'langan!`);
//     }

//     // Bazaga saqlash
//     const newPayout = this.payoutRepo.create({
//       amount: salaryInfo.totalSalary,
//       forMonth: month,
//       teacher: { id: teacherId }
//     });

//     return await this.payoutRepo.save(newPayout);
//   }

//   // 3. To'lovlar tarixini olish
//   async getPayoutHistory(teacherId?: string) {
//     const query = this.payoutRepo.createQueryBuilder('payout')
//       .leftJoinAndSelect('payout.teacher', 'teacher')
//       .orderBy('payout.paidAt', 'DESC');

//     if (teacherId) {
//       query.where('teacher.id = :teacherId', { teacherId });
//     }

//     return await query.getMany();
//   }
// }

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { SalaryPayout } from '../entities/salaryPayout.entity';
import { Attendance } from '../entities/attendance.entity';
import { PaySalaryDto } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(SalaryPayout) private payoutRepo: Repository<SalaryPayout>,
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    private dataSource: DataSource,
  ) {}

 
async calculateTeacherSalary(teacherId: string, month: string) {
  const teacher = await this.userRepo.findOne({
    where: { id: teacherId, role: UserRole.TEACHER },
    relations: ['teachingGroups'],
  });

  if (!teacher) throw new NotFoundException('O\'qituvchi topilmadi');
  
  // Foiz null bo'lsa 0 deb hisoblash yoki xato berish
  const percentage = teacher.salaryPercentage ?? 0;
  if (percentage === 0) throw new BadRequestException('O\'qituvchi foizi belgilanmagan');

  let totalSalary = 0;
 const details: Array<{
      groupName: string;
      studentAttendances: number;
      groupTotalIncome: number;
      teacherEarned: number;
    }> = [];

  for (const group of teacher.teachingGroups) {
    const attendanceCount = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .where('attendance.groupId = :groupId', { groupId: group.id })
      .andWhere('CAST(attendance.date AS TEXT) LIKE :month', { month: `${month}%` })
      .andWhere('attendance.isPresent = true')
      .getCount();

    const groupIncome = attendanceCount * Number(group.price); // Decimal to Number
    const teacherShare = (groupIncome * percentage) / 100;

    totalSalary += teacherShare;
    details.push({
      groupName: group.name,
      studentAttendances: attendanceCount,
      groupTotalIncome: groupIncome,
      teacherEarned: teacherShare,
    });
  }

  return { teacherName: teacher.fullName, month, totalSalary, details  };
}
// 1. Oylik to'lash (Create)
  async paySalary(dto: PaySalaryDto) {
    const { teacherId, month, amount } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(SalaryPayout, {
        where: { teacher: { id: teacherId }, forMonth: month }
      });
      if (existing) throw new BadRequestException('Bu oy uchun oylik allaqachon to\'langan');

      const payout = queryRunner.manager.create(SalaryPayout, {
        amount,
        forMonth: month,
        teacher: { id: teacherId },
      });

      const saved = await queryRunner.manager.save(payout);
      await queryRunner.commitTransaction();
      return { message: 'Oylik muvaffaqiyatli saqlandi', payout: saved };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 2. Barcha to'langan oyliklarni olish (Get All)
  async findAll(searchMonth?: string) {
    const query = this.payoutRepo.createQueryBuilder('payout')
      .leftJoinAndSelect('payout.teacher', 'teacher')
      .orderBy('payout.createdAt', 'DESC');

    if (searchMonth) {
      query.where('payout.forMonth = :month', { month: searchMonth });
    }

    return await query.getMany();
  }

  // 3. Bitta to'lov ma'lumotini olish (Get One)
  async findOne(id: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      relations: ['teacher'],
    });
    if (!payout) throw new NotFoundException('Oylik to\'lovi topilmadi');
    return payout;
  }

  // 4. To'lov miqdorini yangilash (Update)
  async update(id: string, amount: number) {
    const payout = await this.findOne(id);
    payout.amount = amount;
    return await this.payoutRepo.save(payout);
  }

  // 5. To'lovni bekor qilish (Delete)
  async remove(id: string) {
    const payout = await this.findOne(id);
    return await this.payoutRepo.remove(payout);
  }
}