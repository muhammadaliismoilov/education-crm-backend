// import {
//   Injectable,
//   NotFoundException,
//   BadRequestException,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { DataSource, Repository } from 'typeorm';
// import { User, UserRole } from '../entities/user.entity';
// import { SalaryPayout } from '../entities/salaryPayout.entity';
// import { Attendance } from '../entities/attendance.entity';
// import { PaySalaryDto } from './salary.dto';

// @Injectable()
// export class SalaryService {
//   constructor(
//     @InjectRepository(User) private userRepo: Repository<User>,
//     @InjectRepository(SalaryPayout)
//     private payoutRepo: Repository<SalaryPayout>,
//     @InjectRepository(Attendance)
//     private attendanceRepo: Repository<Attendance>,
//     private dataSource: DataSource,
//   ) {}

//   async getEstimatedSalaries(month?: string) {
//     // 1. Agar oy berilmasa, joriy oyni (YYYY-MM) formatida olamiz
//     const targetMonth = month ?? new Date().toISOString().slice(0, 7);

//     // 2. Tizimdagi barcha faol o'qituvchilarni olamiz
//     const teachers = await this.userRepo.find({
//       where: { role: UserRole.TEACHER },
//     });

//     const report: {
//       teacherId: string;
//       teacherName: string;
//       calculatedSalary: number;
//       month: string;
//       details: {
//         groupName: string;
//         groupDays: number[];
//         totalLessonsInMonth: number;
//         perLessonRate: number;
//         attendanceCount: number;
//         teacherEarned: number;
//       }[];
//     }[] = [];

//     for (const teacher of teachers) {
//       // 3. Har bir o'qituvchi uchun davomat asosida oylikni hisoblaymiz
//       // Bu metod bazaga yozmaydi, faqat hisob-kitob natijasini qaytaradi
//       const salaryData = await this.calculateTeacherSalary(
//         teacher.id,
//         targetMonth,
//       );

//       // Faqat oyligi 0 dan baland bo'lganlarni ro'yxatga qo'shamiz
//       if (salaryData.totalSalary > 0) {
//         report.push({
//           teacherId: teacher.id,
//           teacherName: teacher.fullName,
//           calculatedSalary: salaryData.totalSalary,
//           month: targetMonth,
//           details: salaryData.details, // Guruhlar kesimidagi batafsil ma'lumot
//         });
//       }
//     }

//     return {
//       timestamp: new Date().toISOString(),
//       month: targetMonth,
//       teachersCount: report.length,
//       data: report,
//     };
//   }

//   async calculateTeacherSalary(teacherId: string, month: string) {
//     // 1. Ma'lumotlarni yuklash: teacher va uning barcha teachingGroups munosabatlari
//     const teacher = await this.userRepo.findOne({
//       where: { id: teacherId, role: UserRole.TEACHER },
//       relations: ['teachingGroups'],
//     });

//     if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

//     const percentage = teacher.salaryPercentage ?? 0;
//     if (percentage === 0)
//       throw new BadRequestException("O'qituvchi foizi belgilanmagan");

//     // 2. O'zbekcha kun nomlarini JS Date formatiga (0-6) o'girish xaritasi
//     const dayMapping: Record<string, number> = {
//       Yakshanba: 0,
//       Dushanba: 1,
//       Seshanba: 2,
//       Chorshanba: 3,
//       Payshanba: 4,
//       Juma: 5,
//       Shanba: 6,
//     };

//     let totalSalary = 0;
//     const details: {
//       groupName: string;
//       groupDays: number[];
//       totalLessonsInMonth: number;
//       perLessonRate: number;
//       attendanceCount: number;
//       teacherEarned: number;
//     }[] = [];

//     for (const group of teacher.teachingGroups) {
//       // 3. Dinamik kunlarni aniqlash: agar guruhda 1 kun bo'lsa ham, 2 kun bo'lsa ham ishlaydi
//       const rawDays = group.days && group.days.length > 0 ? group.days : [];

//       // Matnli kunlarni raqamga o'giramiz va xato qiymatlarni filtrlash orqali xavfsizlikni ta'minlaymiz
//       const numericDays: number[] = rawDays
//         .map((d: string) => dayMapping[d])
//         .filter((d: number | undefined) => d !== undefined);

//       // Agar bazada kunlar kiritilmagan bo'lsa, cheksiz hisob-kitobni oldini olish uchun
//       if (numericDays.length === 0) continue;

//       // 4. Kalendar bo'yicha aynan shu oydagi darslar sonini sanash
//       const lessonsInMonth = this.countSpecificDaysInMonth(month, numericDays);

//       // 5. Bitta darsning o'quvchi uchun dinamik qiymati (800k / oydagi_darslar)
//       const perLessonRate =
//         lessonsInMonth > 0 ? Number(group.price) / lessonsInMonth : 0;

//       // 6. Shu oydagi jami "keldi" (isPresent = true) belgilarini bitta so'rovda olish
//       const attendanceCount = await this.attendanceRepo
//         .createQueryBuilder('attendance')
//         .where('attendance.groupId = :groupId', { groupId: group.id })
//         .andWhere('CAST(attendance.date AS TEXT) LIKE :month', {
//           month: `${month}%`,
//         })
//         .andWhere('attendance.isPresent = true')
//         .getCount();

//       // 7. O'qituvchi ulushini hisoblash: (dars_narxi * foiz / 100) * kelganlar_soni
//       const teacherSharePerStudent = (perLessonRate * percentage) / 100;
//       const teacherEarned = attendanceCount * teacherSharePerStudent;

//       totalSalary += teacherEarned;

//       details.push({
//         groupName: group.name,
//         groupDays: numericDays, // Admin tekshirishi uchun raqamli kunlar
//         totalLessonsInMonth: lessonsInMonth,
//         perLessonRate: Math.round(perLessonRate),
//         attendanceCount: attendanceCount,
//         teacherEarned: Math.round(teacherEarned),
//       });
//     }

//     return {
//       teacherName: teacher.fullName,
//       month,
//       totalSalary: Math.round(totalSalary),
//       details,
//     };
//   }

//   // Yordamchi funksiya: Oy ichidagi har qanday kombinatsiyadagi kunlarni sanash
//   private countSpecificDaysInMonth(
//     monthStr: string,
//     daysToCount: number[],
//   ): number {
//     const [year, month] = monthStr.split('-').map(Number);
//     const date = new Date(year, month - 1, 1);
//     let count = 0;

//     while (date.getMonth() === month - 1) {
//       if (daysToCount.includes(date.getDay())) {
//         count++;
//       }
//       date.setDate(date.getDate() + 1);
//     }
//     return count;
//   }
//   // 1. Oylik to'lash (Create)
//   async paySalary(dto: PaySalaryDto) {
//     const { teacherId, month, amount } = dto;
//     const queryRunner = this.dataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       const existing = await queryRunner.manager.findOne(SalaryPayout, {
//         where: { teacher: { id: teacherId }, forMonth: month },
//       });
//       if (existing)
//         throw new BadRequestException("Bu oy uchun oylik allaqachon to'langan");

//       const payout = queryRunner.manager.create(SalaryPayout, {
//         amount,
//         forMonth: month,
//         teacher: { id: teacherId },
//       });

//       const saved = await queryRunner.manager.save(payout);
//       await queryRunner.commitTransaction();
//       return { message: 'Oylik muvaffaqiyatli saqlandi', payout: saved };
//     } catch (err) {
//       await queryRunner.rollbackTransaction();
//       throw err;
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   // 2. Barcha to'langan oyliklarni olish (Get All)
//   async findAll(searchMonth?: string) {
//     const query = this.payoutRepo
//       .createQueryBuilder('payout')
//       .leftJoinAndSelect('payout.teacher', 'teacher')
//       .orderBy('payout.createdAt', 'DESC');

//     if (searchMonth) {
//       query.where('payout.forMonth = :month', { month: searchMonth });
//     }

//     return await query.getMany();
//   }

//   // 3. Bitta to'lov ma'lumotini olish (Get One)
//   async findOne(id: string) {
//     const payout = await this.payoutRepo.findOne({
//       where: { id },
//       relations: ['teacher'],
//     });
//     if (!payout) throw new NotFoundException("Oylik to'lovi topilmadi");
//     return payout;
//   }

//   // 4. To'lov miqdorini yangilash (Update)
//   async update(id: string, amount: number) {
//     const payout = await this.findOne(id);
//     payout.amount = amount;
//     return await this.payoutRepo.save(payout);
//   }

//   // 5. To'lovni bekor qilish (Delete)
//   async remove(id: string) {
//     const payout = await this.findOne(id);
//     return await this.payoutRepo.remove(payout);
//   }
// }


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

  // ─────────────────────────────────────────────
  // 1. BARCHA O'QITUVCHILAR OYLIGI
  // ─────────────────────────────────────────────
  async getEstimatedSalaries(startDate?: string, endDate?: string) {
    const now = new Date();

    // Agar sana berilmasa — joriy oy
    const start =
      startDate ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end =
      endDate ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

    const teachers = await this.userRepo.find({
      where: { role: UserRole.TEACHER },
    });

    const report: any[] = [];

    for (const teacher of teachers) {
      const salaryData = await this.calculateTeacherSalary(
        teacher.id,
        start,
        end,
      ).catch(() => ({ totalSalary: 0, details: [] }));

      if (salaryData.totalSalary > 0) {
        report.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          calculatedSalary: salaryData.totalSalary,
          startDate: start,
          endDate: end,
          details: salaryData.details,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      startDate: start,
      endDate: end,
      teachersCount: report.length,
      data: report,
    };
  }

  // ─────────────────────────────────────────────
  // 2. BITTA O'QITUVCHI OYLIGI HISOBLASH
  // ─────────────────────────────────────────────
  async calculateTeacherSalary(
    teacherId: string,
    startDate: string,
    endDate: string,
  ) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
      relations: ['teachingGroups'],
    });

    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    const percentage = teacher.salaryPercentage ?? 0;
    if (percentage === 0)
      throw new BadRequestException("O'qituvchi foizi belgilanmagan");

    const dayMapping: Record<string, number> = {
      Yakshanba: 0,
      Dushanba: 1,
      Seshanba: 2,
      Chorshanba: 3,
      Payshanba: 4,
      Juma: 5,
      Shanba: 6,
    };

    const groupIds = teacher.teachingGroups.map((g) => g.id);
    if (groupIds.length === 0) {
      return {
        teacherName: teacher.fullName,
        startDate,
        endDate,
        totalSalary: 0,
        details: [],
      };
    }

    // ✅ 1. Bitta query — barcha talabalar + discountlar
    const studentsWithDiscounts = await this.userRepo.manager
      .createQueryBuilder()
      .select([
        's.id            AS "studentId"',
        'g.id            AS "groupId"',
        'g.price         AS "groupPrice"',
        'sd.customPrice  AS "customPrice"',
      ])
      .from('students', 's')
      .innerJoin('group_students', 'gs', 'gs."studentsId" = s.id')
      .innerJoin('groups', 'g', 'g.id = gs."groupsId"')
      .leftJoin(
        'student_discounts',
        'sd',
        'sd."studentId" = s.id AND sd."groupId" = g.id',
      )
      .where('g.id IN (:...groupIds)', { groupIds })
      .andWhere('s."deletedAt" IS NULL')
      .getRawMany();

    // ✅ 2. Bitta query — berilgan sana oralig'idagi davomat
    const attendanceCounts = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.groupId', 'groupId')
      .addSelect('a.studentId', 'studentId')
      .addSelect('COUNT(*)', 'count')
      .where('a.groupId IN (:...groupIds)', { groupIds })
      .andWhere('a.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.isPresent = true')
      .groupBy('a.groupId, a.studentId')
      .getRawMany();

    // ✅ 3. Attendance Map — O(1) qidirish
    // key: "groupId_studentId" → count
    const attendanceMap = new Map<string, number>(
      attendanceCounts.map((row) => [
        `${row.groupId}_${row.studentId}`,
        Number(row.count || 0),
      ]),
    );

    // ✅ 4. Students Map — guruh bo'yicha guruhlash
    // key: groupId → students[]
    const studentsByGroup = new Map<string, typeof studentsWithDiscounts>();
    for (const row of studentsWithDiscounts) {
      if (!studentsByGroup.has(row.groupId)) {
        studentsByGroup.set(row.groupId, []);
      }
      studentsByGroup.get(row.groupId)!.push(row);
    }

    // ✅ 5. Hisoblash
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
      const rawDays = group.days?.length > 0 ? group.days : [];
      const numericDays = rawDays
        .map((d: string) => dayMapping[d])
        .filter((d: number | undefined) => d !== undefined);

      if (numericDays.length === 0) continue;

      // ✅ Berilgan sana oralig'idagi darslar soni
      const lessonsInRange = this.countDaysInRange(
        startDate,
        endDate,
        numericDays,
      );
      if (lessonsInRange === 0) continue;

      const students = studentsByGroup.get(group.id) || [];

      // ✅ Har bir talaba uchun discount hisobga olingan holda hisoblash
      let groupAttendanceCount = 0;
      let groupTeacherEarned = 0;
      let totalPerLessonRate = 0;

      for (const student of students) {
        // Discount bor bo'lsa — customPrice, yo'q bo'lsa — group.price
        const effectivePrice =
          student.customPrice !== null
            ? Number(student.customPrice)
            : Number(student.groupPrice);

        // Bitta darsning narxi
        const perLessonRate = effectivePrice / lessonsInRange;

        // Talabaning davomati (Map dan O(1))
        const attendanceCount =
          attendanceMap.get(`${group.id}_${student.studentId}`) || 0;

        // O'qituvchi ulushi
        const teacherEarned = Math.round(
          (perLessonRate * percentage) / 100 * attendanceCount,
        );

        groupAttendanceCount += attendanceCount;
        groupTeacherEarned += teacherEarned;
        totalPerLessonRate += perLessonRate;
      }

      // O'rtacha perLessonRate (frontend uchun)
      const avgPerLessonRate =
        students.length > 0
          ? Math.round(totalPerLessonRate / students.length)
          : Math.round(Number(group.price) / lessonsInRange);

      totalSalary += groupTeacherEarned;

      // ✅ Eski format — frontend o'zgarmaydi
      details.push({
        groupName: group.name,
        groupDays: numericDays,
        totalLessonsInMonth: lessonsInRange,
        perLessonRate: avgPerLessonRate,
        attendanceCount: groupAttendanceCount,
        teacherEarned: Math.round(groupTeacherEarned),
      });
    }

    return {
      teacherName: teacher.fullName,
      startDate,
      endDate,
      totalSalary: Math.round(totalSalary),
      details,
    };
  }

  // ─────────────────────────────────────────────
  // HELPER — sana oralig'idagi guruh kunlarini sanash
  // ─────────────────────────────────────────────
  private countDaysInRange(
    startDate: string,
    endDate: string,
    daysToCount: number[],
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    let count = 0;

    while (current <= end) {
      if (daysToCount.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // ─────────────────────────────────────────────
  // HELPER — oy ichidagi guruh kunlarini sanash
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 3. OYLIK TO'LASH
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 4. BARCHA TO'LANGAN OYLIKLAR
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 5. BITTA TO'LOV
  // ─────────────────────────────────────────────
  async findOne(id: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      relations: ['teacher'],
    });
    if (!payout) throw new NotFoundException("Oylik to'lovi topilmadi");
    return payout;
  }

  // ─────────────────────────────────────────────
  // 6. TO'LOVNI YANGILASH
  // ─────────────────────────────────────────────
  async update(id: string, amount: number) {
    const payout = await this.findOne(id);
    payout.amount = amount;
    return await this.payoutRepo.save(payout);
  }

  // ─────────────────────────────────────────────
  // 7. TO'LOVNI O'CHIRISH
  // ─────────────────────────────────────────────
  async remove(id: string) {
    const payout = await this.findOne(id);
    return await this.payoutRepo.remove(payout);
  }
}