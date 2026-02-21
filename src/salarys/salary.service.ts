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

  async getEstimatedSalaries(month?: string) {
    // 1. Agar oy berilmasa, joriy oyni (YYYY-MM) formatida olamiz
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    // 2. Tizimdagi barcha faol o'qituvchilarni olamiz
    const teachers = await this.userRepo.find({
      where: { role: UserRole.TEACHER },
    });

    const report: {
      teacherId: string;
      teacherName: string;
      calculatedSalary: number;
      month: string;
      details: {
        groupName: string;
        groupDays: number[];
        totalLessonsInMonth: number;
        perLessonRate: number;
        attendanceCount: number;
        teacherEarned: number;
      }[];
    }[] = [];

    for (const teacher of teachers) {
      // 3. Har bir o'qituvchi uchun davomat asosida oylikni hisoblaymiz
      // Bu metod bazaga yozmaydi, faqat hisob-kitob natijasini qaytaradi
      const salaryData = await this.calculateTeacherSalary(
        teacher.id,
        targetMonth,
      );

      // Faqat oyligi 0 dan baland bo'lganlarni ro'yxatga qo'shamiz
      if (salaryData.totalSalary > 0) {
        report.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          calculatedSalary: salaryData.totalSalary,
          month: targetMonth,
          details: salaryData.details, // Guruhlar kesimidagi batafsil ma'lumot
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      month: targetMonth,
      teachersCount: report.length,
      data: report,
    };
  }

  async calculateTeacherSalary(teacherId: string, month: string) {
    // 1. Ma'lumotlarni yuklash: teacher va uning barcha teachingGroups munosabatlari
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
      relations: ['teachingGroups'],
    });

    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    const percentage = teacher.salaryPercentage ?? 0;
    if (percentage === 0)
      throw new BadRequestException("O'qituvchi foizi belgilanmagan");

    // 2. O'zbekcha kun nomlarini JS Date formatiga (0-6) o'girish xaritasi
    const dayMapping: Record<string, number> = {
      Yakshanba: 0,
      Dushanba: 1,
      Seshanba: 2,
      Chorshanba: 3,
      Payshanba: 4,
      Juma: 5,
      Shanba: 6,
    };

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
      // 3. Dinamik kunlarni aniqlash: agar guruhda 1 kun bo'lsa ham, 2 kun bo'lsa ham ishlaydi
      const rawDays = group.days && group.days.length > 0 ? group.days : [];

      // Matnli kunlarni raqamga o'giramiz va xato qiymatlarni filtrlash orqali xavfsizlikni ta'minlaymiz
      const numericDays: number[] = rawDays
        .map((d: string) => dayMapping[d])
        .filter((d: number | undefined) => d !== undefined);

      // Agar bazada kunlar kiritilmagan bo'lsa, cheksiz hisob-kitobni oldini olish uchun
      if (numericDays.length === 0) continue;

      // 4. Kalendar bo'yicha aynan shu oydagi darslar sonini sanash
      const lessonsInMonth = this.countSpecificDaysInMonth(month, numericDays);

      // 5. Bitta darsning o'quvchi uchun dinamik qiymati (800k / oydagi_darslar)
      const perLessonRate =
        lessonsInMonth > 0 ? Number(group.price) / lessonsInMonth : 0;

      // 6. Shu oydagi jami "keldi" (isPresent = true) belgilarini bitta so'rovda olish
      const attendanceCount = await this.attendanceRepo
        .createQueryBuilder('attendance')
        .where('attendance.groupId = :groupId', { groupId: group.id })
        .andWhere('CAST(attendance.date AS TEXT) LIKE :month', {
          month: `${month}%`,
        })
        .andWhere('attendance.isPresent = true')
        .getCount();

      // 7. O'qituvchi ulushini hisoblash: (dars_narxi * foiz / 100) * kelganlar_soni
      const teacherSharePerStudent = (perLessonRate * percentage) / 100;
      const teacherEarned = attendanceCount * teacherSharePerStudent;

      totalSalary += teacherEarned;

      details.push({
        groupName: group.name,
        groupDays: numericDays, // Admin tekshirishi uchun raqamli kunlar
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
      details,
    };
  }

  // Yordamchi funksiya: Oy ichidagi har qanday kombinatsiyadagi kunlarni sanash
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
