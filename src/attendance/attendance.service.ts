import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attendance } from 'src/entities/attendance.entity';
import { Repository } from 'typeorm';
import { MarkAttendanceDto } from './mark-attendance.dto';


@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) 
    private attendanceRepo: Repository<Attendance>,
  ) {}

  async markAttendance(dto: MarkAttendanceDto) {
    // 1. O'sha guruh va o'sha kungi mavjud davomatni o'chiramiz (Duplicate bo'lmasligi uchun)
    await this.attendanceRepo.delete({
      group: { id: dto.groupId },
      date: dto.date,
    });

    // 2. Yangi davomat yozuvlarini massiv qilib yaratamiz
    const records = dto.students.map((s) =>
      this.attendanceRepo.create({
        group: { id: dto.groupId },
        student: { id: s.studentId },
        date: dto.date,
        isPresent: s.isPresent,
      }),
    );

    // 3. Bazaga ommaviy saqlaymiz (Bulk Save)
    return await this.attendanceRepo.save(records);
  }

  // Guruhning ma'lum kungi davomatini ko'rish
  async getByGroupAndDate(groupId: string, date: string) {
    return await this.attendanceRepo.find({
      where: { group: { id: groupId }, date },
      relations: ['student'],
    });
  }
}