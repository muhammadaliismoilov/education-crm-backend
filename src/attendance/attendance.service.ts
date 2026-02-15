import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attendance } from '../entities/attendance.entity';
import { Group } from '../entities/group.entity';
import { DataSource, Repository } from 'typeorm';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    private dataSource: DataSource,
  ) {}

  async getAttendanceSheet(groupId: string, date: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'], // Talabalarni yuklaymiz
    });

    if (!group) throw new NotFoundException('Guruh topilmadi');

    const existingAttendance = await this.attendanceRepo.find({
      where: { group: { id: groupId }, date },
      relations: ['student'],
    });

    // Guruhdagi umumiy to'lov qilganlar sonini hisoblash (balansi > 0 bo'lganlar)
    const paidStudentsCount = group.students.filter(
      (s) => s.balance > 0,
    ).length;

    const studentsList = group.students.map((student) => {
      const att = existingAttendance.find((a) => a.student.id === student.id);
      return {
        studentId: student.id,
        fullName: student.fullName,
        isPresent: att ? att.isPresent : true,
        balance: student.balance,
        hasPaid: student.balance > 0,
      };
    });

    return {
      groupInfo: {
        id: group.id,
        name: group.name,
        paidStudentsCount,
        totalStudents: group.students.length,
      },
      students: studentsList,
    };
  }

  async markBulk(dto: MarkAttendanceDto) {
    const { groupId, date, students } = dto;

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(Attendance, {
        group: { id: groupId },
        date,
      });

      const records = students.map((s) =>
        this.attendanceRepo.create({
          date,
          isPresent: s.isPresent,
          group: { id: groupId },
          student: { id: s.studentId },
        }),
      );

      await queryRunner.manager.save(Attendance, records);
      await queryRunner.commitTransaction();
      return { success: true, message: 'Davomat saqlandi' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Davomatni saqlashda xatolik: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateSingleAttendance(dto: UpdateSingleAttendanceDto) {
    const { groupId, date, studentId, isPresent } = dto;

    let attendance = await this.attendanceRepo.findOne({
      where: { group: { id: groupId }, date, student: { id: studentId } },
    });

    if (attendance) {
      attendance.isPresent = isPresent;
    } else {
      attendance = this.attendanceRepo.create({
        group: { id: groupId },
        date,
        student: { id: studentId },
        isPresent,
      });
    }

    return await this.attendanceRepo.save(attendance);
  }

  async getGroupMonthlyAttendance(groupId: string, month?: string) {
    // Format tekshirish (YYYY-MM)
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'Month formati noto‘g‘ri. To‘g‘ri format: YYYY-MM (masalan: 2026-02)',
      );
    }
    // 1️⃣ Oyni aniqlash (YYYY-MM)
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 2️⃣ Guruhni olish
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
      order: { students: { fullName: 'ASC' } },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    // 3️⃣ Oydagi barcha attendance yozuvlari
    const attendanceRecords = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .leftJoinAndSelect('attendance.group', 'group')
      .where('attendance.groupId = :groupId', { groupId })
      .andWhere('attendance.date >= :startDate', { startDate })
      .andWhere('attendance.date < :endDate', { endDate })
      .orderBy('attendance.date', 'ASC')
      .getMany();

    // 4️⃣ Unikal Sana + Vaqt columnlar
    const distinctColumns = Array.from(
      new Set(
        attendanceRecords.map(
          (r) =>
            `${typeof r.date === 'string' ? r.date.slice(0, 10) : (r.date as Date).toISOString().slice(0, 10)} ${r.group?.startTime || ''}`,
        ),
      ),
    ).sort();

    // 5️⃣ Tez qidirish uchun Map
    const attendanceMap = new Map<string, boolean>();

    attendanceRecords.forEach((rec) => {
      if (rec.student) {
        const date =
          typeof rec.date === 'string'
            ? rec.date.slice(0, 10)
            : (rec.date as Date).toISOString().slice(0, 10);
        const time = rec.group?.startTime || '';
        const key = `${rec.student.id}_${date}_${time}`;
        attendanceMap.set(key, rec.isPresent);
      }
    });

    // 6️⃣ Pivot table qurish
    const reportData = group.students.map((student) => {
      let totalPresent = 0;
      const dailyStatus: Record<string, number | null> = {};

      distinctColumns.forEach((col) => {
        const [date, time] = col.split(' ');
        const key = `${student.id}_${date}_${time || ''}`;

        if (attendanceMap.has(key)) {
          const isPresent = attendanceMap.get(key);
          dailyStatus[col] = isPresent ? 1 : 0;

          if (isPresent) totalPresent++;
        } else {
          dailyStatus[col] = null;
        }
      });

      return {
        studentId: student.id,
        fullName: student.fullName,
        totalPresent,
        attendance: dailyStatus,
      };
    });

    return {
      groupInfo: {
        id: group.id,
        name: group.name,
        totalStudents: group.students.length,
      },
      month: targetMonth,
      columns: distinctColumns,
      students: reportData,
    };
  }
}
