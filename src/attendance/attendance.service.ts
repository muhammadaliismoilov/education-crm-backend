import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attendance } from '../entities/attendance.entity';
import { Group } from '../entities/group.entity';
import { Student } from '../entities/students.entity';
import { DataSource, Repository } from 'typeorm';
import { MarkAttendanceDto } from './mark-attendance.dto';
import { UpdateSingleAttendanceDto } from './update-single-attendance.dto';
import { UserRole } from '../entities/user.entity';
import { FaceService } from '../common/faceId/faceId.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    private dataSource: DataSource,
    private faceService: FaceService,
  ) {}

  private checkLessonTime(group: Group, role: UserRole): void {
    if (role === UserRole.ADMIN) return;

    const rawStart = group.startTime?.includes('-')
      ? group.startTime.split('-')[0].trim()
      : group.startTime;

    const rawEnd = group.startTime?.includes('-')
      ? group.startTime.split('-')[1].trim()
      : group.endTime;

    if (!rawStart || !rawEnd) return;

    const uzTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Tashkent',
    });
    const now = new Date(uzTime);
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = rawStart.split(':').map(Number);
    const [endHour, endMinute] = rawEnd.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute - 10;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (
      currentTotalMinutes < startTotalMinutes ||
      currentTotalMinutes > endTotalMinutes
    ) {
      throw new ForbiddenException(
        `Davomat faqat dars vaqtida qilinishi mumkin: ${rawStart} - ${rawEnd}`,
      );
    }
  }

  async getAttendanceSheet(groupId: string, date: string, role: UserRole) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        "Sana formati noto'g'ri. To'g'ri format: YYYY-MM-DD",
      );
    }

    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

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

  async markBulk(dto: MarkAttendanceDto, role: UserRole) {
    const { groupId, date, students } = dto;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        "Sana formati noto'g'ri. To'g'ri format: YYYY-MM-DD",
      );
    }

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

      // TUZATISH 1: muvaffaqiyatli saqlash loglanmayapti — audit uchun kerak
      this.logger.log(
        `Davomat saqlandi [group: ${groupId}] [date: ${date}] [count: ${students.length}]`,
      );

      return { success: true, message: 'Davomat saqlandi' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Davomat saqlashda xato [group: ${groupId}]`,
        err.stack,
      );
      throw new BadRequestException(
        'Davomatni saqlashda xatolik: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

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

  async faceVerifyAttendance(
    groupId: string,
    date: string,
    base64: string,
    role: UserRole,
  ) {
    if (!base64 || !base64.startsWith('data:image')) {
      throw new BadRequestException(
        "base64 formati noto'g'ri! data:image/jpeg;base64,... ko'rinishida yuboring",
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        "Sana formati noto'g'ri. To'g'ri format: YYYY-MM-DD",
      );
    }

    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    this.checkLessonTime(group, role);

    const studentsWithFace = group.students.filter(
      (s) => s.faceDescriptor && s.faceDescriptor.length === 128,
    );

    if (studentsWithFace.length === 0) {
      throw new BadRequestException(
        "Bu guruhda yuz ma'lumoti saqlangan talaba yo'q!",
      );
    }

    let incomingDescriptor: number[];
    try {
      incomingDescriptor =
        await this.faceService.getDescriptorFromBase64(base64);
    } catch (e) {
      throw new BadRequestException(
        'Rasmda yuz topilmadi! Aniqroq rasm yuboring.',
      );
    }

    let matchedStudent: Student | null = null;
    let highestSimilarity = 0;

    for (const student of studentsWithFace) {
      const storedDescriptor = Array.isArray(student.faceDescriptor)
        ? student.faceDescriptor.map(Number)
        : JSON.parse(student.faceDescriptor as any);

      const similarity = this.faceService.getSimilarity(
        storedDescriptor,
        incomingDescriptor,
      );

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        matchedStudent = student;
      }
    }

    // TUZATISH 2: debug loglar (emoji li) production da qolgan edi — olib tashlandi
    this.logger.log(
      `Face verify: guruh=${group.name}, eng yuqori oxshashlik=${highestSimilarity}%`,
    );

    if (!matchedStudent || highestSimilarity < 55) {
      return {
        success: false,
        message: 'Talaba tanilmadi',
        similarity: highestSimilarity,
      };
    }

    let attendance = await this.attendanceRepo.findOne({
      where: {
        group: { id: groupId },
        date,
        student: { id: matchedStudent.id },
      },
    });

    if (attendance?.isPresent) {
      return {
        success: true,
        message: `${matchedStudent.fullName} davomat allaqachon belgilangan`,
        studentId: matchedStudent.id,
        fullName: matchedStudent.fullName,
        similarity: highestSimilarity,
        alreadyMarked: true,
      };
    }

    if (attendance) {
      attendance.isPresent = true;
    } else {
      attendance = this.attendanceRepo.create({
        group: { id: groupId },
        date,
        student: { id: matchedStudent.id },
        isPresent: true,
      });
    }

    await this.attendanceRepo.save(attendance);

    this.logger.log(
      `Davomat belgilandi: ${matchedStudent.fullName} (${highestSimilarity}%) [group: ${groupId}]`,
    );

    return {
      success: true,
      message: `${matchedStudent.fullName} davomatga belgilandi`,
      studentId: matchedStudent.id,
      fullName: matchedStudent.fullName,
      similarity: highestSimilarity,
      alreadyMarked: false,
    };
  }

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
