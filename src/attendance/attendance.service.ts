import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attendance } from '../entities/attendance.entity';
import { Group } from '../entities/group.entity';
import { DataSource, Repository } from 'typeorm';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    private dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────
  // HELPER — dars vaqtini tekshirish
  // ─────────────────────────────────────────────
private checkLessonTime(group: Group, role: UserRole): void {
  if (role === UserRole.ADMIN) return;
  
  const rawStart = group.startTime.includes('-') 
    ? group.startTime.split('-')[0].trim() 
    : group.startTime;
    
  const rawEnd = group.startTime.includes('-') 
    ? group.startTime.split('-')[1].trim() 
    : group.endTime;

  if (!rawStart || !rawEnd) return;

  const uzTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' });
  const now = new Date(uzTime);
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMinute] = rawStart.split(':').map(Number);
  const [endHour, endMinute] = rawEnd.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  // QIDIRUV (DEBUG) UCHUN LOGLAR
  console.log('--- DAVOMAT VAQTI TEKSHIRUVI ---');
  console.log('Hozirgi soat (UZB):', now.getHours() + ':' + now.getMinutes());
  console.log('Hozirgi jami daqiqa:', currentTotalMinutes);
  console.log('Dars boshlanishi (daqiqa):', startTotalMinutes);
  console.log('Dars tugashi (daqiqa):', endTotalMinutes);
  console.log('Farq Start:', currentTotalMinutes - startTotalMinutes);
  console.log('Farq End:', endTotalMinutes - currentTotalMinutes);
  console.log('-------------------------------');

  if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
    throw new ForbiddenException(
      `Davomat faqat dars vaqtida qilinishi mumkin: ${rawStart} - ${rawEnd}`,
    );
  }
}
  // ─────────────────────────────────────────────
  // DAVOMAT SAHIFASI — role tekshiruvi bilan
  // ─────────────────────────────────────────────
  async getAttendanceSheet(groupId: string, date: string, role: UserRole) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
    });

    if (!group) throw new NotFoundException('Guruh topilmadi');

    // ✅ Teacher uchun vaqt tekshiruvi — sahifa ochilishidan oldin
    this.checkLessonTime(group, role);

    const existingAttendance = await this.attendanceRepo.find({
      where: { group: { id: groupId }, date },
      relations: ['student'],
    });

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
        startTime: group.startTime,
        endTime: group.endTime,
        paidStudentsCount,
        totalStudents: group.students.length,
      },
      students: studentsList,
    };
  }

  // ─────────────────────────────────────────────
  // OMMAVIY DAVOMAT — role tekshiruvi bilan
  // ─────────────────────────────────────────────
  async markBulk(dto: MarkAttendanceDto, role: UserRole) {
    const { groupId, date, students } = dto;

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    this.checkLessonTime(group, role);

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

  // ─────────────────────────────────────────────
  // BITTA DAVOMAT YANGILASH — role tekshiruvi bilan
  // ─────────────────────────────────────────────
  async updateSingleAttendance(dto: UpdateSingleAttendanceDto, role: UserRole) {
    const { groupId, date, studentId, isPresent } = dto;

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    this.checkLessonTime(group, role);

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

  // ─────────────────────────────────────────────
  // OYLIK DAVOMAT
  // ─────────────────────────────────────────────
  async getGroupMonthlyAttendance(groupId: string, month?: string) {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        "Month formati noto'g'ri. To'g'ri format: YYYY-MM (masalan: 2026-02)",
      );
    }

    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
      order: { students: { fullName: 'ASC' } },
    });

    if (!group) throw new NotFoundException('Guruh topilmadi');

    const attendanceRecords = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .leftJoinAndSelect('attendance.group', 'group')
      .where('attendance.groupId = :groupId', { groupId })
      .andWhere('attendance.date >= :startDate', { startDate })
      .andWhere('attendance.date < :endDate', { endDate })
      .orderBy('attendance.date', 'ASC')
      .getMany();

    const distinctColumns = Array.from(
      new Set(
        attendanceRecords.map(
          (r) =>
            `${typeof r.date === 'string' ? r.date.slice(0, 10) : (r.date as Date).toISOString().slice(0, 10)} ${r.group?.startTime || ''}`,
        ),
      ),
    ).sort();

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
