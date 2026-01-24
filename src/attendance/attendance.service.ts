import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attendance } from 'src/entities/attendance.entity';
import { Group } from 'src/entities/groupe.entity';
import { Repository } from 'typeorm';
import { MarkAttendanceDto } from './mark-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
  ) {}

  // 1. O'qituvchi uchun davomat sahifasini shakllantirish
  async getAttendanceSheet(groupId: string, date: string) {
   const group = await this.groupRepo.findOne({
    where: { id: groupId },
    relations: ['students', 'teacher'], // teacher-ni ham qo'shdik
    select: {
      id: true,
      name: true,      // "Informatika"
      days: true,      // "DU-CHOR-JUMA"
      startTime: true, // "14:00-16:00"
      teacher: {
        fullName: true,
        phone: true
      },
      students: { id: true, fullName: true }
    }
  });

    if (!group) throw new NotFoundException('Guruh topilmadi');

    const existingAttendance = await this.attendanceRepo.find({
      where: { group: { id: groupId }, date },
    });

    return group.students.map((student) => {
      const att = existingAttendance.find((a) => a.student.id === student.id);
      return {
        studentId: student.id,
        fullName: student.fullName,
        isPresent: att ? att.isPresent : true,
      };
    });
  }

  // 2. Davomatni saqlash yoki yangilash (Bulk)
  async markBulk(dto: MarkAttendanceDto) {
    // 1. Guruh borligini tekshirish
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) {
      throw new NotFoundException(
        `ID-si ${dto.groupId} bo'lgan guruh topilmadi!`,
      );
    }

    // 2. Eskisini o'chirish
    await this.attendanceRepo.delete({
      group: { id: dto.groupId },
      date: dto.date,
    });

    // 3. Saqlash...
    const records = dto.students.map((s) =>
      this.attendanceRepo.create({
        date: dto.date,
        isPresent: s.isPresent,
        group: { id: dto.groupId },
        student: { id: s.studentId },
      }),
    );

    return await this.attendanceRepo.save(records);
  }
}
