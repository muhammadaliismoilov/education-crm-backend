import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/entities/groupe.entity';
import { User, UserRole } from 'src/entities/user.entity';
import { ILike, Repository } from 'typeorm';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';


@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // CREATE
  async create(dto: CreateGroupDto) {
    await this.checkTeacherAvailability(dto.teacherId, dto.days, dto.startTime);

    const group = this.groupRepo.create({
      ...dto,
      teacher: { id: dto.teacherId }
    });
    return await this.groupRepo.save(group);
  }

  private async checkTeacherAvailability(teacherId: string, days: string[], startTime: string, excludeGroupId?: string) {
    // 1. O'qituvchining barcha guruhlarini olish
    const existingGroups = await this.groupRepo.find({
      where: { teacher: { id: teacherId } },
    });

    for (const group of existingGroups) {
      // Update bo'layotgan bo'lsa, o'zini o'zi bilan solishtirmaslik uchun
      if (excludeGroupId && group.id === excludeGroupId) continue;

      // Kunlar ustma-ust tushishini tekshirish
      const commonDays = group.days.filter(day => days.includes(day));
      
      if (commonDays.length > 0) {
        // Vaqtni raqamga o'tkazamiz (masalan "14:00" -> 14.0)
        const newStart = this.timeToNumber(startTime);
        const existingStart = this.timeToNumber(group.startTime);
        
        // 2 soatlik intervalni tekshirish
        const diff = Math.abs(newStart - existingStart);
        
        if (diff < 2) {
          throw new BadRequestException(
            `Bu o'qituvchining ${commonDays.join(', ')} kunlari soat ${group.startTime} da "${group.name}" guruhi bor. ` +
            `Siz darsni soat ${this.numberToTime(existingStart + 2)} dan keyin qo'yishingiz mumkin.`
          );
        }
      }
    }
  }

  // "14:30" -> 14.5 formatiga o'tkazish
  private timeToNumber(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours + (minutes / 60);
  }

  // 16.5 -> "16:30" formatiga o'tkazish
  private numberToTime(num: number): string {
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  

  // READ (All)
  async findAll(search?: string) {
  return await this.groupRepo.find({
    where: search ? { name: ILike(`%${search}%`) } : {},
    relations: ['teacher'],
    order: { name: 'ASC' }
  });
}

  // READ (One)
  async getGroupDetails(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['teacher', 'students'],
      select: {
      id: true,
      name: true,
      days: true,
      startTime: true,
      price: true,
      teacher: {
        id: true,
        fullName: true,
        phone: true,
      },
      students: {
        id: true,
        fullName: true,
        salaryPercentage: true, // Studentning salaryPercentage'i
      },}
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  // UPDATE (PATCH)
  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.getGroupDetails(id);
    
    // Agar vaqt yoki kun o'zgarsa, qayta tekshiramiz
    if (dto.startTime || dto.days || dto.teacherId) {
      await this.checkTeacherAvailability(
        dto.teacherId || group.teacher.id,
        dto.days || group.days,
        dto.startTime || group.startTime,
        id // joriy guruh ID-sini o'tkazib yuboramiz
      );
    }

    Object.assign(group, dto);
    if (dto.teacherId) group.teacher = { id: dto.teacherId } as any;

    return await this.groupRepo.save(group);
  }

  // DELETE
  async remove(id: string) {
    const group = await this.getGroupDetails(id);
    await this.groupRepo.remove(group);
    return { message: 'Guruh muvaffaqiyatli o\'chirildi' };
  }

  // ADD STUDENT
  async addStudentToGroup(groupId: string, studentId: string) {
    const group = await this.getGroupDetails(groupId);

    const student = await this.userRepo.findOne({ where: { id: studentId, role: UserRole.STUDENT } });
    if (!student) throw new NotFoundException('Student topilmadi');

    const isExist = group.students.find(s => s.id === studentId);
    if (!isExist) {
      group.students.push(student);
      await this.groupRepo.save(group);
    }
    
    return { message: 'Student guruhga muvaffaqiyatli qo\'shildi' };
  }

  // REMOVE STUDENT FROM GROUP (Guruhdan o'quvchini chiqarib yuborish)
  async removeStudentFromGroup(groupId: string, studentId: string) {
    const group = await this.getGroupDetails(groupId);
    
    group.students = group.students.filter(s => s.id !== studentId);
    await this.groupRepo.save(group);
    
    return { message: 'Student guruhdan o\'chirildi' };
  }
}