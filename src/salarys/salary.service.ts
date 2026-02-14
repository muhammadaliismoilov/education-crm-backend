import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { SalaryPayout } from '../entities/salaryPayout.entity';
import { Attendance } from '../entities/attendance.entity';
import { PaySalaryDto } from './salary.dto';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(SalaryPayout)
    private payoutRepo: Repository<SalaryPayout>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    private dataSource: DataSource,
  ) {}

  async calculateTeacherSalary(teacherId: string, month: string) {
  const teacher = await this.userRepo.findOne({
    where: { id: teacherId, role: UserRole.TEACHER },
    relations: ['teachingGroups'], // Har bir guruhning 'days' va 'price' ma'lumoti kelishi kerak
  });

  if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

  const percentage = teacher.salaryPercentage ?? 0;
  let totalSalary = 0;
  const details: {
    groupName: string;
    groupDays: number[];
    totalLessonsInMonth: number;
    perLessonRate: number;
    attendanceCount: number;
    teacherEarned: number;
  }[] = [];

  for (const group of teacher.teachingGroups) {
    // 1. Dinamik dars kunlari: Guruhning o'zidan olingan kunlar (masalan: [2, 4, 6] yoki [1, 4])
    // Agar bazada 'days' bo'sh bo'lsa, xatolik chiqmasligi uchun default [1, 3, 5] qo'shdik
    const groupDaysRaw = group.days && group.days.length > 0 ? group.days : [1, 3, 5];
    const groupDays: number[] = groupDaysRaw.map((d: string | number) => Number(d));
    
    // 2. Aynan shu guruh kunlari asosida oydagi darslar sonini sanaymiz
    const lessonsInMonth = this.countSpecificDaysInMonth(month, groupDays);

    // 3. Bitta darsning o'quvchi uchun dinamik narxi
    const perLessonRate = lessonsInMonth > 0 ? Number(group.price) / lessonsInMonth : 0;

    // 4. Shu oyda o'qituvchi yo'qlama qilgan jami "keldi"lar soni
    const attendanceCount = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .where('attendance.groupId = :groupId', { groupId: group.id })
      .andWhere('CAST(attendance.date AS TEXT) LIKE :month', { month: `${month}%` })
      .andWhere('attendance.isPresent = true')
      .getCount();

    // 5. O'qituvchining ulushini hisoblash
    const teacherSharePerStudent = (perLessonRate * percentage) / 100;
    const teacherEarned = attendanceCount * teacherSharePerStudent;

    totalSalary += teacherEarned;
    details.push({
      groupName: group.name,
      groupDays: groupDays, // Qaysi kunlari dars ekanligi (tekshirish uchun)
      totalLessonsInMonth: lessonsInMonth,
      perLessonRate: Math.round(perLessonRate),
      attendanceCount: attendanceCount,
      teacherEarned: Math.round(teacherEarned),
    });
  }

  return { 
    teacherName: teacher.fullName, 
    month, 
    totalSalary: Math.round(totalSalary), 
    details 
  };
}

  // Yordamchi funksiya: Oy ichidagi dars kunlarini sanash
  private countSpecificDaysInMonth(
    monthStr: string,
    daysToCount: number[],
  ): number {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    let count = 0;

    while (date.getMonth() === month - 1) {
      if (daysToCount.includes(date.getDay())) {
        count++;
      }
      date.setDate(date.getDate() + 1);
    }
    return count;
  }
  // 1. Oylik to'lash (Create)
  async paySalary(dto: PaySalaryDto) {
    const { teacherId, month, amount } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(SalaryPayout, {
        where: { teacher: { id: teacherId }, forMonth: month },
      });
      if (existing)
        throw new BadRequestException("Bu oy uchun oylik allaqachon to'langan");

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
    const query = this.payoutRepo
      .createQueryBuilder('payout')
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
    if (!payout) throw new NotFoundException("Oylik to'lovi topilmadi");
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
