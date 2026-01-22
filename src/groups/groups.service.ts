import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/entities/groupe.entity';
import { User, UserRole } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateGroupDto, UpdateGroupDto } from './create-group.dto';


@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // CREATE
  async create(dto: CreateGroupDto) {
    const group = this.groupRepo.create({
      name: dto.name,
      price: dto.price,
      startTime: dto.startTime,
      teacher: { id: dto.teacherId }
    });
    return await this.groupRepo.save(group);
  }

  // READ (All)
  async findAll() {
    return await this.groupRepo.find({
      relations: ['teacher'],
      order: { name: 'ASC' }
    });
  }

  // READ (One)
  async getGroupDetails(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['teacher', 'students'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  // UPDATE (PATCH)
  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.getGroupDetails(id);

    // Agar teacherId kelsa, uni obyekt ko'rinishida yangilaymiz
    if (dto.teacherId) {
      group.teacher = { id: dto.teacherId } as User;
    }

    // Qolgan oddiy fieldlarni (name, price, etc.) biriktiramiz
    Object.assign(group, {
      ...dto,
      teacher: group.teacher // teacher obyektini saqlab qolamiz
    });

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