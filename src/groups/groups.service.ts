import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/entities/group.entity';

import { Repository, ILike } from 'typeorm';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';
import { Student } from 'src/entities/students.entity';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  async create(dto: CreateGroupDto) {
    await this.checkTeacherAvailability(dto.teacherId, dto.days, dto.startTime);

    const group = this.groupRepo.create({
      ...dto,
      teacher: { id: dto.teacherId },
    });
    return await this.groupRepo.save(group);
  }

  async findAll(search?: string, page = 1, limit = 10) {
    const query = this.groupRepo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.teacher', 'teacher')
      .loadRelationCountAndMap('group.studentsCount', 'group.students'); // O'quvchilar sonini sanash

    if (search) {
      query.andWhere('group.name ILike :search', { search: `%${search}%` });
    }

    const [items, total] = await query
      .orderBy('group.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async getGroupDetails(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['teacher', 'students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.getGroupDetails(id);

    if (dto.startTime || dto.days || dto.teacherId) {
      await this.checkTeacherAvailability(
        dto.teacherId || group.teacher.id,
        dto.days || group.days,
        dto.startTime || group.startTime,
        id,
      );
    }

    Object.assign(group, dto);
    if (dto.teacherId) group.teacher = { id: dto.teacherId } as any;

    return await this.groupRepo.save(group);
  }

  async remove(id: string) {
    const group = await this.getGroupDetails(id);
    await this.groupRepo.softRemove(group); // Soft delete ishlatish
    return { message: 'Guruh arxivlandi' };
  }
  async addStudentToGroup(groupId: string, studentId: string) {
    // 1. Guruh va student mavjudligini tekshiring
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    // 2. Takroriy qo'shishni oldini olish
    const isAlreadyIn = group.students.some((s) => s.id === studentId);
    if (isAlreadyIn)
      throw new BadRequestException("O'quvchi allaqachon guruhda bor");

    // 3. To'g'ridan-to'g'ri bog'lovchi jadvalga yozish (Eng xavfsiz yo'l)
    await this.groupRepo
      .createQueryBuilder()
      .relation(Group, 'students')
      .of(groupId)
      .add(studentId);

    return { message: "Student guruhga qo'shildi" };
  }

  // Talabani guruhdan chetlatish
  async removeStudentFromGroup(groupId: string, studentId: string) {
    const group = await this.getGroupDetails(groupId);

    // Talaba guruhda borligini tekshirish
    const studentIndex = group.students.findIndex((s) => s.id === studentId);

    if (studentIndex === -1) {
      throw new NotFoundException('Bu talaba ushbu guruhda topilmadi');
    }

    // Talabani massivdan olib tashlash
    group.students.splice(studentIndex, 1);
    await this.groupRepo.save(group);

    return { message: 'Talaba guruhdan muvaffaqiyatli chetlatildi' };
  }

  // --- Yordamchi metodlar (Private) ---

  private async checkTeacherAvailability(
    teacherId: string,
    days: string[],
    startTime: string,
    excludeId?: string,
  ) {
    const teacherGroups = await this.groupRepo.find({
      where: { teacher: { id: teacherId } },
    });

    const newStart = this.timeToNumber(startTime);

    for (const group of teacherGroups) {
      if (excludeId && group.id === excludeId) continue;

      const hasCommonDay = group.days.some((day) => days.includes(day));
      if (hasCommonDay) {
        const existingStart = this.timeToNumber(group.startTime);
        const diff = Math.abs(newStart - existingStart);

        if (diff < 2) {
          throw new BadRequestException(
            `O'qituvchi bu vaqtda band. "${group.name}" guruhi bor (${group.startTime}).`,
          );
        }
      }
    }
  }

  private timeToNumber(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h + m / 60;
  }
}
