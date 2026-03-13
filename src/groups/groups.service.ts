import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { Repository } from 'typeorm';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { Student } from '../entities/students.entity';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

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

    const saved = await this.groupRepo.save(group);

    // SABABI: Yangi guruh yaratildi — audit uchun
    this.logger.log(
      `Guruh yaratildi [id: ${saved.id}] [nomi: ${saved.name}] [teacher: ${dto.teacherId}]`,
    );

    return saved;
  }

  async findAll(search?: string, page = 1, limit = 10) {
    const query = this.groupRepo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.teacher', 'teacher')
      .loadRelationCountAndMap('group.studentsCount', 'group.students');

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

    const saved = await this.groupRepo.save(group);

    // SABABI: Guruh o'zgartirildi — audit uchun
    this.logger.log(`Guruh yangilandi [id: ${id}]`);

    return saved;
  }

  async remove(id: string) {
    const group = await this.getGroupDetails(id);
    await this.groupRepo.softRemove(group);

    // SABABI: Arxivlash qaytarib bo'lmaydigan harakat — audit uchun
    this.logger.log(`Guruh arxivlandi [id: ${id}] [nomi: ${group.name}]`);

    return { message: 'Guruh arxivlandi' };
  }

  async addStudentToGroup(groupId: string, studentId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    // TUZATISH: student mavjudligini tekshirish yo'q edi —
    // mavjud bo'lmagan studentId bilan relation yozilishi mumkin edi
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Talaba topilmadi');

    const isAlreadyIn = group.students.some((s) => s.id === studentId);
    if (isAlreadyIn)
      throw new BadRequestException("O'quvchi allaqachon guruhda bor");

    await this.groupRepo
      .createQueryBuilder()
      .relation(Group, 'students')
      .of(groupId)
      .add(studentId);

    this.logger.log(
      `Talaba guruhga qo'shildi [group: ${groupId}] [student: ${studentId}]`,
    );

    return { message: "Student guruhga qo'shildi" };
  }

  async removeStudentFromGroup(groupId: string, studentId: string) {
    const group = await this.getGroupDetails(groupId);

    const studentIndex = group.students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1)
      throw new NotFoundException('Bu talaba ushbu guruhda topilmadi');

    group.students.splice(studentIndex, 1);
    await this.groupRepo.save(group);

    this.logger.log(
      `Talaba guruhdan chiqarildi [group: ${groupId}] [student: ${studentId}]`,
    );

    return { message: 'Talaba guruhdan muvaffaqiyatli chetlatildi' };
  }

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
