import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentType, Student } from 'src/entities/students.entity';
import { Group } from 'src/entities/group.entity';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
  ) {}

  // 1. Student yaratish (Advanced logic bilan)
  async create(dto: CreateStudentDto) {
    const { groupIds, ...studentData } = dto;

    // 1. Telefon raqami bandligini tekshiramiz
    const existingStudent = await this.studentRepo.findOne({ 
      where: { phone: dto.phone } 
    });

    if (existingStudent) {
      throw new ConflictException("Ushbu telefon raqamli o'quvchi allaqachon mavjud");
    }
    // Guruhlar borligini tekshirish
    const groups = await this.groupRepo.findBy({ id: In(groupIds) });
    if (groups.length !== groupIds.length) {
      throw new NotFoundException("Bir yoki bir nechta tanlangan guruhlar topilmadi");
    }

    // const student = this.studentRepo.create({
    //   ...studentData,
    //   // DTO dagi groupName ni direction ustuniga saqlaymiz
    //   direction: dto.direction || (groups.length > 0 ? groups[0].name : undefined),
    //   enrolledGroups: groups,
    // });
    const student = this.studentRepo.create({
      fullName: studentData.fullName,
      phone: studentData.phone,
      parentName: studentData.parentName,
      parentPhone: studentData.parentPhone,
      documentNumber: studentData.documentNumber,
      pinfl: studentData.pinfl,
      birthDate:studentData.birthDate,
      documentType: studentData.documentType as DocumentType, 
      direction: dto.direction || (groups.length > 0 ? groups[0].name : undefined),
      enrolledGroups: groups,
    });
    

    return await this.studentRepo.save(student);
  }

  // 2. Pagination va Search (ILike bilan)
  async findAll(search?: string, groupName?: string, page = 1, limit = 10) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.enrolledGroups', 'group');

    if (search) {
      query.andWhere(
        '(student.fullName ILike :search OR student.phone ILike :search)',
        { search: `%${search}%` },
      );
    }

    if (groupName) {
      query.andWhere('student.direction = :groupName', { groupName });
    }

    const [items, total] = await query
      .orderBy('student.createdAt', 'DESC')
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

  // 3. FindOne - Bog'liqliklar bilan
  async findOne(id: string) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: ['enrolledGroups', 'payments', 'attendances'],
    });

    if (!student) throw new NotFoundException('Student topilmadi');
    return student;
  }

  // 4. Update (Professional Patch mantiqi)
  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.findOne(id);
    const { groupIds, ...updateData } = dto;

    // Student maydonlarini yangilash
    Object.assign(student, updateData);

    // Guruhlarni qayta biriktirish
    if (groupIds) {
      const groups = await this.groupRepo.findBy({ id: In(groupIds) });
      if (groups.length !== groupIds.length) {
        throw new BadRequestException("Yuborilgan ID-lar orasida xato bor");
      }
      student.enrolledGroups = groups;
      
      // Agar yangi guruhlar kelsa, directionni ham yangilashimiz mumkin
      if (!dto.direction) {
        student.direction = groups[0].name;
      }
    }

    return await this.studentRepo.save(student);
  }

  // 5. Soft Delete (Arxivlash)
  async remove(id: string) {
    const student = await this.findOne(id);
    // softRemove o'rniga softDelete ham ishlatsa bo'ladi, 
    // lekin entity hooks ishlashi uchun softRemove yaxshiroq
    await this.studentRepo.softRemove(student);
    return { success: true, message: "O'quvchi muvaffaqiyatli arxivlandi" };
  }

  async findAllDeleted(search?: string, page = 1, limit = 10) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .withDeleted(); // O'chirilganlarni ham olish uchun

      query.andWhere('student.deletedAt IS NOT NULL');
      
    if (search) {
      query.andWhere(
        '(student.fullName ILike :search OR student.phone ILike :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await query
      .andWhere('student.deletedAt IS NOT NULL') // Faqat o'chirilganlar
      .orderBy('student.deletedAt', 'DESC')
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

  async restore(id: string) {
    await this.studentRepo.restore(id);
    const restoredStudent = await this.findOne(id);
    return restoredStudent;
  }


}