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
        paidStudentsCount, // Dizayndagi "To'lov qilganlar: 10ta" qismi uchun
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
}
