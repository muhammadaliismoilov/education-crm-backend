import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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

  async create(dto: CreateStudentDto) {
    const { groupIds, pinfl, documentNumber, ...studentData } = dto;

    // 1. Unikal maydonlarni (phone, pinfl, documentNumber) bir vaqtda tekshiramiz
    // Bu metod bazaga ortiqcha so'rovlarni kamaytiradi
    const existing = await this.studentRepo.findOne({
      where: [
        { phone: dto.phone },
        ...(pinfl ? [{ pinfl }] : []),
        ...(documentNumber ? [{ documentNumber }] : []),
      ],
    });

    if (existing) {
      if (existing.phone === dto.phone) {
        throw new ConflictException(
          "Ushbu telefon raqamli o'quvchi allaqachon mavjud",
        );
      }
      if (pinfl && existing.pinfl === pinfl) {
        throw new ConflictException(
          "Ushbu JSHSHIR (PINFL) raqamli o'quvchi allaqachon mavjud",
        );
      }
      if (documentNumber && existing.documentNumber === documentNumber) {
        throw new ConflictException(
          "Ushbu seria raqamli o'quvchi allaqachon mavjud",
        );
      }
    }

    // 2. Guruhlar borligini tekshirish
    const groups = await this.groupRepo.findBy({ id: In(groupIds) });
    if (groups.length !== groupIds.length) {
      throw new NotFoundException(
        'Bir yoki bir nechta tanlangan guruhlar topilmadi',
      );
    }

    // 3. Student obyektini yaratish
    // Obyektni create orqali yaratishda barcha unikal maydonlarni aniq ko'rsatamiz
    const student = this.studentRepo.create({
      fullName: studentData.fullName,
      phone: studentData.phone,
      parentName: studentData.parentName,
      parentPhone: studentData.parentPhone,
      documentNumber: documentNumber,
      pinfl: pinfl,
      // String formatidagi sanani Date obyektiga o'girish (PostgreSQL 500 bermasligi uchun)
      birthDate: studentData.birthDate
        ? new Date(studentData.birthDate)
        : undefined,
      documentType: studentData.documentType as DocumentType,
      direction:
        dto.direction || (groups.length > 0 ? groups[0].name : undefined),
      enrolledGroups: groups,
    });

    try {
      // 4. Bazaga saqlash
      return await this.studentRepo.save(student);
    } catch (error) {
      // Agar kutilmagan baza xatosi bo'lsa (masalan, race condition)
      if (error.code === '23505') {
        // Postgres unique_violation kodi
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi. Iltimos, ma'lumotlarni tekshiring.",
        );
      }
      throw error;
    }
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

  async update(id: string, dto: UpdateStudentDto) {
    // 1. O'quvchini topamiz
    const student = await this.findOne(id);
    const { groupIds, pinfl, documentNumber, phone, ...updateData } = dto;

    // 2. Unikal maydonlar bandligini tekshirish (o'zidan boshqalarda)
    // Bu mantiq: "O'zgarayotgan ma'lumot boshqa bir o'quvchida bormi?" degan savolga javob beradi
    if (phone || pinfl || documentNumber) {
      const conflictCheck = await this.studentRepo.findOne({
        where: [
          ...(phone ? [{ phone }] : []),
          ...(pinfl ? [{ pinfl }] : []),
          ...(documentNumber ? [{ documentNumber }] : []),
        ],
      });

      // Agar topilsa va u hozirgi tahrirlanayotgan o'quvchi bo'lmasa - xato!
      if (conflictCheck && conflictCheck.id !== id) {
        if (phone && conflictCheck.phone === phone)
          throw new ConflictException(
            "Ushbu telefon raqami boshqa o'quvchida band",
          );
        if (pinfl && conflictCheck.pinfl === pinfl)
          throw new ConflictException("Ushbu PINFL boshqa o'quvchida band");
        if (documentNumber && conflictCheck.documentNumber === documentNumber)
          throw new ConflictException(
            "Ushbu hujjat raqami boshqa o'quvchida band",
          );
      }
    }

    // 3. Guruhlarni yangilash
    if (groupIds && groupIds.length > 0) {
      const groups = await this.groupRepo.findBy({ id: In(groupIds) });
      if (groups.length !== groupIds.length) {
        throw new NotFoundException(
          'Bir yoki bir nechta tanlangan guruhlar topilmadi',
        );
      }
      student.enrolledGroups = groups;

      // Agar direction berilmagan bo'lsa, birinchi guruh nomini olamiz
      if (!dto.direction) {
        student.direction = groups[0].name;
      }
    }

    // 4. Qolgan maydonlarni xavfsiz yangilash
    student.fullName = updateData.fullName ?? student.fullName;
    student.phone = phone ?? student.phone;
    student.parentName = updateData.parentName ?? student.parentName;
    student.parentPhone = updateData.parentPhone ?? student.parentPhone;
    student.pinfl = pinfl ?? student.pinfl;
    student.documentNumber = documentNumber ?? student.documentNumber;
    student.direction = updateData.direction ?? student.direction;

    // Enum va Sana formatini to'g'irlash
    if (updateData.documentType)
      student.documentType = updateData.documentType as DocumentType;
    if (updateData.birthDate)
      student.birthDate = new Date(updateData.birthDate);

    try {
      return await this.studentRepo.save(student);
    } catch (error) {
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi",
        );
      throw error;
    }
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
      .withDeleted() // O'chirilganlarni ham ko'rish huquqi
      .leftJoinAndSelect('student.enrolledGroups', 'groups') // Qaysi guruhda bo'lganini bilish uchun
      .where('student.deletedAt IS NOT NULL'); // Faqat arxivdagilar

    if (search) {
      query.andWhere(
        '(student.fullName ILike :search OR student.phone ILike :search OR student.pinfl ILike :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await query
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
        itemsPerPage: limit,
      },
    };
  }

  async restore(id: string) {
    await this.studentRepo.restore(id);
    const restoredStudent = await this.findOne(id);
    return restoredStudent;
  }
}
