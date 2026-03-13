import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentType, Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';
import { StudentDiscount } from '../entities/studentDiscount';
import { FaceService } from '../common/faceId/faceId.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(StudentDiscount)
    private discountRepo: Repository<StudentDiscount>,
    private faceService: FaceService,
  ) {}

  // ─────────────────────────────────────────────
  // HELPER — eski rasmni diskdan o'chirish
  // ─────────────────────────────────────────────
  private deleteFileIfExists(filePath: string | null | undefined): void {
    if (!filePath) return;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    try {
      if (fs.existsSync(cleanPath)) {
        fs.unlinkSync(cleanPath);
        // SABABI: Disk to'lib ketmasligi uchun eski fayl o'chirilganini tasdiqlash
        this.logger.log(`Rasm o'chirildi: ${cleanPath}`);
      }
    } catch (e) {
      // SABABI: O'chirish muvaffaqiyatsiz bo'lsa warn — critical emas,
      // lekin disk yoki permission muammosini erta aniqlash uchun kerak
      this.logger.warn(`Rasmni o'chirishda xatolik [${cleanPath}]: ${e.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // HELPER — student formatlash
  // ─────────────────────────────────────────────
  private formatStudent(student: Student) {
    return {
      ...student,
      enrolledGroups: student.enrolledGroups?.map((group) => {
        const discount = student.discounts?.find(
          (d) => d.group?.id === group.id,
        );
        return {
          ...group,
          effectivePrice: discount
            ? Number(discount.customPrice)
            : Number(group.price),
          hasDiscount: !!discount,
        };
      }),
    };
  }

  // ─────────────────────────────────────────────
  // HELPER — rasm saqlash (create va update uchun umumiy)
  // ─────────────────────────────────────────────
  private async processPhoto(
    file: Express.Multer.File,
    studentId: string,
    oldPhotoUrl?: string | null,
  ): Promise<{ photoUrl: string; faceDescriptor: number[] }> {
    let descriptor: number[];
    try {
      descriptor = await this.faceService.getDescriptorFromFile(file.path);
    } catch (e) {
      this.deleteFileIfExists(file.path);
      // SABABI: Yuz topilmasa temp fayl qolmasligi kerak + foydalanuvchiga aniq xabar
      this.logger.warn(`Yuz topilmadi, temp fayl o'chirildi: ${file.path}`);
      throw new BadRequestException(
        "Rasmda yuz topilmadi! Aniqroq, yorug' rasmda yuzingiz ko'rinib tursin.",
      );
    }

    // Eski rasmni o'chirish
    if (oldPhotoUrl) this.deleteFileIfExists(oldPhotoUrl);

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const newFilename = `student_${studentId}_${Date.now()}${ext}`;
    const newPath = path.join('uploads', 'students', newFilename);
    fs.renameSync(file.path, newPath);

    // SABABI: Rasm muvaffaqiyatli saqlangani — monitoring va disk audit uchun muhim
    this.logger.log(`Rasm saqlandi [student: ${studentId}]: ${newPath}`);

    return { photoUrl: `/${newPath}`, faceDescriptor: descriptor };
  }

  // ─────────────────────────────────────────────
  // 1. CREATE
  // ─────────────────────────────────────────────
  async create(dto: CreateStudentDto, file?: Express.Multer.File) {
    const { groupIds, pinfl, documentNumber, ...studentData } = dto;

    const existing = await this.studentRepo.findOne({
      where: [
        { phone: dto.phone },
        ...(pinfl ? [{ pinfl }] : []),
        ...(documentNumber ? [{ documentNumber }] : []),
      ],
    });

    if (existing) {
      if (existing.phone === dto.phone)
        throw new ConflictException(
          "Ushbu telefon raqamli o'quvchi allaqachon mavjud",
        );
      if (pinfl && existing.pinfl === pinfl)
        throw new ConflictException(
          "Ushbu JSHSHIR (PINFL) raqamli o'quvchi allaqachon mavjud",
        );
      if (documentNumber && existing.documentNumber === documentNumber)
        throw new ConflictException(
          "Ushbu seria raqamli o'quvchi allaqachon mavjud",
        );
    }

    const groups = await this.groupRepo.findBy({ id: In(groupIds) });
    if (groups.length !== groupIds.length) {
      throw new NotFoundException(
        'Bir yoki bir nechta tanlangan guruhlar topilmadi',
      );
    }

    const student = this.studentRepo.create({
      fullName: studentData.fullName,
      phone: studentData.phone,
      parentName: studentData.parentName,
      parentPhone: studentData.parentPhone,
      documentNumber,
      pinfl,
      birthDate: studentData.birthDate
        ? new Date(studentData.birthDate)
        : undefined,
      documentType: studentData.documentType as DocumentType,
      direction:
        dto.direction || (groups.length > 0 ? groups[0].name : undefined),
      enrolledGroups: groups,
    });

    try {
      const saved = await this.studentRepo.save(student);
      // SABABI: Yangi talaba yaratildi — kim, qachon yaratilganini audit uchun saqlash
      this.logger.log(`Yangi talaba yaratildi [id: ${saved.id}] [tel: ${saved.phone}]`);

      if (file) {
        const { photoUrl, faceDescriptor } = await this.processPhoto(
          file,
          saved.id,
        );
        saved.photoUrl = photoUrl;
        saved.faceDescriptor = faceDescriptor;
        await this.studentRepo.save(saved);
      }

      return await this.findOne(saved.id);
    } catch (error) {
      // Xatolik bo'lsa temp rasmni tozalash
      this.deleteFileIfExists(file?.path);
      if (error instanceof BadRequestException) throw error;
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi.",
        );
      // SABABI: Kutilmagan xatolikni to'liq stack bilan logga yozish —
      // production da tez topish uchun
      this.logger.error(
        `Talaba yaratishda xatolik [tel: ${dto.phone}]`,
        error.stack,
      );
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // 2. FIND ALL
  // ─────────────────────────────────────────────
  async findAll(search?: string, groupName?: string, page = 1, limit = 10) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.enrolledGroups', 'group')
      .leftJoinAndSelect('student.discounts', 'discount')
      .leftJoinAndSelect('discount.group', 'discountGroup');

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
      items: items.map((s) => this.formatStudent(s)),
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 3. FIND ONE
  // ─────────────────────────────────────────────
  async findOne(id: string) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: [
        'enrolledGroups',
        'payments',
        'attendances',
        'discounts',
        'discounts.group',
      ],
    });
    if (!student) throw new NotFoundException('Student topilmadi');
    return this.formatStudent(student);
  }

  // ─────────────────────────────────────────────
  // 4. UPDATE
  // ─────────────────────────────────────────────
  private keepIfEmpty<T>(newVal: T | undefined | null, oldVal: T): T {
    if (newVal === null || newVal === undefined) return oldVal;
    if (typeof newVal === 'string' && newVal.trim() === '') return oldVal;
    return newVal;
  }

  async update(
    id: string,
    dto: UpdateStudentDto,
    file?: Express.Multer.File,
  ) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: ['enrolledGroups'],
    });

    if (!student) {
      this.deleteFileIfExists(file?.path);
      throw new NotFoundException('Student topilmadi');
    }

    const { groupIds, pinfl, documentNumber, phone, discounts, ...updateData } = dto;

    if (phone?.trim() || pinfl?.trim() || documentNumber?.trim()) {
      const conflictCheck = await this.studentRepo.findOne({
        where: [
          ...(phone?.trim() ? [{ phone }] : []),
          ...(pinfl?.trim() ? [{ pinfl }] : []),
          ...(documentNumber?.trim() ? [{ documentNumber }] : []),
        ],
      });
      if (conflictCheck && conflictCheck.id !== id) {
        if (phone?.trim() && conflictCheck.phone === phone)
          throw new ConflictException("Ushbu telefon raqami boshqa o'quvchida band");
        if (pinfl?.trim() && conflictCheck.pinfl === pinfl)
          throw new ConflictException("Ushbu PINFL boshqa o'quvchida band");
        if (documentNumber?.trim() && conflictCheck.documentNumber === documentNumber)
          throw new ConflictException("Ushbu hujjat raqami boshqa o'quvchida band");
      }
    }

    if (groupIds && groupIds.length > 0) {
      const groups = await this.groupRepo.findBy({ id: In(groupIds) });
      if (groups.length !== groupIds.length)
        throw new NotFoundException(
          'Bir yoki bir nechta tanlangan guruhlar topilmadi',
        );
      student.enrolledGroups = groups;
      if (!dto.direction?.trim()) student.direction = groups[0].name;
    }

    student.fullName       = this.keepIfEmpty(updateData.fullName, student.fullName);
    student.phone          = this.keepIfEmpty(phone, student.phone);
    student.parentName     = this.keepIfEmpty(updateData.parentName, student.parentName);
    student.parentPhone    = this.keepIfEmpty(updateData.parentPhone, student.parentPhone);
    student.pinfl          = this.keepIfEmpty(pinfl, student.pinfl);
    student.documentNumber = this.keepIfEmpty(documentNumber, student.documentNumber);
    student.direction      = this.keepIfEmpty(updateData.direction, student.direction);

    if (updateData.documentType?.trim())
      student.documentType = updateData.documentType as DocumentType;
    if (updateData.birthDate?.trim())
      student.birthDate = new Date(updateData.birthDate);

    if (discounts && discounts.length > 0) {
      for (const discountDto of discounts) {
        const { groupId, customPrice } = discountDto;
        const isInGroup = student.enrolledGroups.some((g) => g.id === groupId);
        if (!isInGroup)
          throw new BadRequestException('Talaba bu guruhda emas!');

        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Guruh topilmadi');

        const existing = await this.discountRepo.findOne({
          where: { student: { id }, group: { id: groupId } },
        });

        if (customPrice === null || customPrice === undefined) {
          if (existing) {
            await this.discountRepo.remove(existing);
            // SABABI: Imtiyoz bekor qilinganini moliyaviy audit uchun saqlash
            this.logger.log(
              `Imtiyoz bekor qilindi [student: ${id}] [group: ${groupId}]`,
            );
          }
        } else {
          if (customPrice >= Number(group.price))
            throw new BadRequestException(
              `Imtiyozli narx ${Number(group.price).toLocaleString()} so'mdan kichik bo'lishi kerak`,
            );
          if (customPrice < 0)
            throw new BadRequestException(
              "Narx 0 dan kichik bo'lishi mumkin emas",
            );

          if (existing) {
            existing.customPrice = customPrice;
            await this.discountRepo.save(existing);
          } else {
            const newDiscount = this.discountRepo.create({
              student: { id },
              group: { id: groupId },
              customPrice,
            });
            await this.discountRepo.save(newDiscount);
          }
          // SABABI: Imtiyoz berilgani/o'zgartirilgani — moliyaviy audit uchun muhim
          this.logger.log(
            `Imtiyoz yangilandi [student: ${id}] [group: ${groupId}] [narx: ${customPrice}]`,
          );
        }
      }
    }

    if (file) {
      const { photoUrl, faceDescriptor } = await this.processPhoto(
        file,
        id,
        student.photoUrl,
      );
      student.photoUrl = photoUrl;
      student.faceDescriptor = faceDescriptor;
    }

    try {
      const saved = await this.studentRepo.save(student);
      // SABABI: Kim, qaysi talaba ma'lumotlari o'zgartirilganini audit uchun saqlash
      this.logger.log(`Talaba yangilandi [id: ${id}]`);
      return this.findOne(saved.id);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi",
        );
      // SABABI: Kutilmagan DB xatoligi — stack bilan logga yozish
      this.logger.error(`Talaba yangilashda xatolik [id: ${id}]`, error.stack);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // 5. REMOVE
  // ─────────────────────────────────────────────
  async remove(id: string) {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException('Student topilmadi');
    await this.studentRepo.softRemove(student);
    // SABABI: O'chirish — qaytarib bo'lmaydigan harakat, kim o'chirgani audit uchun muhim
    this.logger.log(`Talaba arxivlandi [id: ${id}] [tel: ${student.phone}]`);
    return { success: true, message: "O'quvchi muvaffaqiyatli arxivlandi" };
  }

  // ─────────────────────────────────────────────
  // 6. FIND DELETED
  // ─────────────────────────────────────────────
  async findAllDeleted(search?: string, page = 1, limit = 10) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .withDeleted()
      .leftJoinAndSelect('student.enrolledGroups', 'groups')
      .where('student.deletedAt IS NOT NULL');

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

  // ─────────────────────────────────────────────
  // 7. RESTORE
  // ─────────────────────────────────────────────
  async restore(id: string) {
    await this.studentRepo.restore(id);
    // SABABI: Qayta tiklash ham audit uchun muhim harakat
    this.logger.log(`Talaba qayta tiklandi [id: ${id}]`);
    return await this.findOne(id);
  }
}