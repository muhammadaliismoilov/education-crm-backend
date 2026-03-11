// import {
//   Injectable,
//   NotFoundException,
//   BadRequestException,
//   ConflictException,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, In } from 'typeorm';
// import { DocumentType, Student } from '../entities/students.entity';
// import { Group } from '../entities/group.entity';
// import { CreateStudentDto, UpdateStudentDto } from './student.dto';
// import { StudentDiscount } from '../entities/studentDiscount';
// import { FaceService } from '../common/faceId/faceId.service';


// @Injectable()
// export class StudentsService {
//   constructor(
//     @InjectRepository(Student) private studentRepo: Repository<Student>,
//     @InjectRepository(Group) private groupRepo: Repository<Group>,
//     @InjectRepository(StudentDiscount) private discountRepo: Repository<StudentDiscount>, 
//     private faceService:FaceService
//   ) {}

  
//   // 1. CREATE — faqat oddiy talaba, imtiyozsiz
//   async create(dto: CreateStudentDto) {
//     const { groupIds, pinfl, documentNumber, ...studentData } = dto;

//     // 1. Unikal maydonlarni tekshirish
//     const existing = await this.studentRepo.findOne({
//       where: [
//         { phone: dto.phone },
//         ...(pinfl ? [{ pinfl }] : []),
//         ...(documentNumber ? [{ documentNumber }] : []),
//       ],
//     });

//     if (existing) {
//       if (existing.phone === dto.phone)
//         throw new ConflictException("Ushbu telefon raqamli o'quvchi allaqachon mavjud");
//       if (pinfl && existing.pinfl === pinfl)
//         throw new ConflictException("Ushbu JSHSHIR (PINFL) raqamli o'quvchi allaqachon mavjud");
//       if (documentNumber && existing.documentNumber === documentNumber)
//         throw new ConflictException("Ushbu seria raqamli o'quvchi allaqachon mavjud");
//     }

//     // 2. Guruhlar borligini tekshirish
//     const groups = await this.groupRepo.findBy({ id: In(groupIds) });
//     if (groups.length !== groupIds.length) {
//       throw new NotFoundException('Bir yoki bir nechta tanlangan guruhlar topilmadi');
//     }

//     // 3. Student yaratish — imtiyozsiz, oddiy talaba
//     const student = this.studentRepo.create({
//       fullName: studentData.fullName,
//       phone: studentData.phone,
//       parentName: studentData.parentName,
//       parentPhone: studentData.parentPhone,
//       documentNumber,
//       pinfl,
//       birthDate: studentData.birthDate ? new Date(studentData.birthDate) : undefined,
//       documentType: studentData.documentType as DocumentType,
//       direction: dto.direction || (groups.length > 0 ? groups[0].name : undefined),
//       enrolledGroups: groups, // ManyToMany — oddiy
//     });

//     try {
//       return await this.studentRepo.save(student);
//     } catch (error) {
//       if (error.code === '23505')
//         throw new ConflictException("Ma'lumotlar bazasida takrorlanish yuz berdi.");
//       throw error;
//     }
//   }

//   async savePhotoAndDescriptor(
//   studentId: string,
//   file: Express.Multer.File,
// ): Promise<any> {
//   const student = await this.studentRepo.findOne({
//     where: { id: studentId },
//   });
//   if (!student) throw new NotFoundException('Student topilmadi');

//   // Descriptor olish
//   const descriptor = await this.faceService.getDescriptorFromFile(file.path);

//   // Saqlash
//   student.photoUrl = file.path;
//   student.faceDescriptor = descriptor;
//   await this.studentRepo.save(student);

//   return {
//     success: true,
//     message: "Rasm va yuz ma'lumotlari saqlandi",
//     photoUrl: file.path,
//   };
// }

//   // 2. FIND ALL
//   async findAll(search?: string, groupName?: string, page = 1, limit = 10) {
//     const query = this.studentRepo
//       .createQueryBuilder('student')
//       .leftJoinAndSelect('student.enrolledGroups', 'group')
//       .leftJoinAndSelect('student.discounts', 'discount')
//       .leftJoinAndSelect('discount.group', 'discountGroup');

//     if (search) {
//       query.andWhere(
//         '(student.fullName ILike :search OR student.phone ILike :search)',
//         { search: `%${search}%` },
//       );
//     }

//     if (groupName) {
//       query.andWhere('student.direction = :groupName', { groupName });
//     }

//     const [items, total] = await query
//       .orderBy('student.createdAt', 'DESC')
//       .skip((page - 1) * limit)
//       .take(limit)
//       .getManyAndCount();

//     return {
//       items: items.map((s) => this.formatStudent(s)),
//       meta: {
//         totalItems: total,
//         totalPages: Math.ceil(total / limit),
//         currentPage: page,
//       },
//     };
//   }

//   // 3. FIND ONE
//   async findOne(id: string) {
//     const student = await this.studentRepo.findOne({
//       where: { id },
//       relations: [
//         'enrolledGroups',
//         'payments',
//         'attendances',
//         'discounts',
//         'discounts.group',
//       ],
//     });

//     if (!student) throw new NotFoundException('Student topilmadi');
//     return this.formatStudent(student);
//   }

//   // 4. UPDATE — imtiyoz ham shu yerda beriladi
//   async update(id: string, dto: UpdateStudentDto) {
//     const student = await this.studentRepo.findOne({
//       where: { id },
//       relations: ['enrolledGroups'],
//     });
//     if (!student) throw new NotFoundException('Student topilmadi');

//     const { groupIds, pinfl, documentNumber, phone, discounts, ...updateData } = dto;

//     // 1. Unikal maydonlar tekshiruvi
//     if (phone || pinfl || documentNumber) {
//       const conflictCheck = await this.studentRepo.findOne({
//         where: [
//           ...(phone ? [{ phone }] : []),
//           ...(pinfl ? [{ pinfl }] : []),
//           ...(documentNumber ? [{ documentNumber }] : []),
//         ],
//       });

//       if (conflictCheck && conflictCheck.id !== id) {
//         if (phone && conflictCheck.phone === phone)
//           throw new ConflictException("Ushbu telefon raqami boshqa o'quvchida band");
//         if (pinfl && conflictCheck.pinfl === pinfl)
//           throw new ConflictException("Ushbu PINFL boshqa o'quvchida band");
//         if (documentNumber && conflictCheck.documentNumber === documentNumber)
//           throw new ConflictException("Ushbu hujjat raqami boshqa o'quvchida band");
//       }
//     }

//     // 2. Guruhlarni yangilash
//     if (groupIds && groupIds.length > 0) {
//       const groups = await this.groupRepo.findBy({ id: In(groupIds) });
//       if (groups.length !== groupIds.length)
//         throw new NotFoundException('Bir yoki bir nechta tanlangan guruhlar topilmadi');
//       student.enrolledGroups = groups;
//       if (!dto.direction) student.direction = groups[0].name;
//     }

//     // 3. Asosiy maydonlarni yangilash
//     student.fullName = updateData.fullName ?? student.fullName;
//     student.phone = phone ?? student.phone;
//     student.parentName = updateData.parentName ?? student.parentName;
//     student.parentPhone = updateData.parentPhone ?? student.parentPhone;
//     student.pinfl = pinfl ?? student.pinfl;
//     student.documentNumber = documentNumber ?? student.documentNumber;
//     student.direction = updateData.direction ?? student.direction;

//     if (updateData.documentType)
//       student.documentType = updateData.documentType as DocumentType;
//     if (updateData.birthDate)
//       student.birthDate = new Date(updateData.birthDate);

//     // 4.  IMTIYOZ YANGILASH
//     if (discounts && discounts.length > 0) {
//       for (const discountDto of discounts) {
//         const { groupId, customPrice } = discountDto;

//         // Talaba bu guruhda borligini tekshirish
//         const isInGroup = student.enrolledGroups.some((g) => g.id === groupId);
//         if (!isInGroup)
//           throw new BadRequestException(`Talaba bu guruhda emas!`);

//         const group = await this.groupRepo.findOne({ where: { id: groupId } });
//         if (!group) throw new NotFoundException('Guruh topilmadi');

//         // Mavjud imtiyozni qidiramiz
//         const existing = await this.discountRepo.findOne({
//           where: { student: { id }, group: { id: groupId } },
//         });

//         if (customPrice === null || customPrice === undefined) {
//           //  null — imtiyozni bekor qilish
//           if (existing) await this.discountRepo.remove(existing);
//         } else {
//           // Narx validatsiyasi
//           if (customPrice >= Number(group.price))
//             throw new BadRequestException(
//               `Imtiyozli narx ${Number(group.price).toLocaleString()} so'mdan kichik bo'lishi kerak`,
//             );
//           if (customPrice < 0)
//             throw new BadRequestException("Narx 0 dan kichik bo'lishi mumkin emas");

//           if (existing) {
//             //  Bor — yangilash
//             existing.customPrice = customPrice;
//             await this.discountRepo.save(existing);
//           } else {
//             //  Yo'q — yaratish
//             const newDiscount = this.discountRepo.create({
//               student: { id },
//               group: { id: groupId },
//               customPrice,
//             });
//             await this.discountRepo.save(newDiscount);
//           }
//         }
//       }
//     }

//     try {
//       const saved = await this.studentRepo.save(student);
//       return this.findOne(saved.id); //  discounts bilan qaytarish
//     } catch (error) {
//       if (error.code === '23505')
//         throw new ConflictException("Ma'lumotlar bazasida takrorlanish yuz berdi");
//       throw error;
//     }
//   }

//   // 5. REMOVE, RESTORE, FIND DELETED
//   async remove(id: string) {
//     const student = await this.studentRepo.findOne({ where: { id } });
//     if (!student) throw new NotFoundException('Student topilmadi');
//     await this.studentRepo.softRemove(student);
//     return { success: true, message: "O'quvchi muvaffaqiyatli arxivlandi" };
//   }

//   async findAllDeleted(search?: string, page = 1, limit = 10) {
//     const query = this.studentRepo
//       .createQueryBuilder('student')
//       .withDeleted()
//       .leftJoinAndSelect('student.enrolledGroups', 'groups')
//       .where('student.deletedAt IS NOT NULL');

//     if (search) {
//       query.andWhere(
//         '(student.fullName ILike :search OR student.phone ILike :search OR student.pinfl ILike :search)',
//         { search: `%${search}%` },
//       );
//     }

//     const [items, total] = await query
//       .orderBy('student.deletedAt', 'DESC')
//       .skip((page - 1) * limit)
//       .take(limit)
//       .getManyAndCount();

//     return {
//       items,
//       meta: {
//         totalItems: total,
//         totalPages: Math.ceil(total / limit),
//         currentPage: page,
//         itemsPerPage: limit,
//       },
//     };
//   }

//   async restore(id: string) {
//     await this.studentRepo.restore(id);
//     return await this.findOne(id);
//   }

//   // HELPER — effectivePrice hisoblash
//   private formatStudent(student: Student) {
//     return {
//       ...student,
//       enrolledGroups: student.enrolledGroups?.map((group) => {
//         const discount = student.discounts?.find(
//           (d) => d.group?.id === group.id,
//         );
//         return {
//           ...group,
//           effectivePrice: discount
//             ? Number(discount.customPrice)  // imtiyozli narx
//             : Number(group.price),          // standart narx
//           hasDiscount: !!discount,
//         };
//       }),
//     };
//   }
// }

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
    // "/" bilan boshlansa olib tashlaymiz (relative path uchun)
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    try {
      if (fs.existsSync(cleanPath)) {
        fs.unlinkSync(cleanPath);
        this.logger.log(`🗑️ Eski rasm o'chirildi: ${cleanPath}`);
      }
    } catch (e) {
      this.logger.warn(`Rasm o'chirishda xatolik: ${e.message}`);
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
  // 1. CREATE — faqat ma'lumotlar (rasm yo'q)
  // ─────────────────────────────────────────────
  async create(dto: CreateStudentDto) {
    const { groupIds, pinfl, documentNumber, ...studentData } = dto;

    // Unikal maydonlar tekshiruvi
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
      return await this.studentRepo.save(student);
    } catch (error) {
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi.",
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
  // 4. UPDATE — ma'lumotlar + ixtiyoriy rasm
  // ─────────────────────────────────────────────
 // Helper funksiya — service class ichida
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

  // ─── Unikal maydonlar tekshiruvi ───
  const newPhone = this.keepIfEmpty(phone, student.phone);
  const newPinfl = this.keepIfEmpty(pinfl, student.pinfl);
  const newDocNumber = this.keepIfEmpty(documentNumber, student.documentNumber);

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

  // ─── Guruhlarni yangilash ───
  if (groupIds && groupIds.length > 0) {
    const groups = await this.groupRepo.findBy({ id: In(groupIds) });
    if (groups.length !== groupIds.length)
      throw new NotFoundException('Bir yoki bir nechta tanlangan guruhlar topilmadi');
    student.enrolledGroups = groups;
    if (!dto.direction?.trim()) student.direction = groups[0].name;
  }

  // ─── Asosiy maydonlarni yangilash ───
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

  // ─── Imtiyoz yangilash ───
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
        if (existing) await this.discountRepo.remove(existing);
      } else {
        if (customPrice >= Number(group.price))
          throw new BadRequestException(
            `Imtiyozli narx ${Number(group.price).toLocaleString()} so'mdan kichik bo'lishi kerak`,
          );
        if (customPrice < 0)
          throw new BadRequestException("Narx 0 dan kichik bo'lishi mumkin emas");

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
      }
    }
  }

  // ─── Rasm yuklash ───
  if (file) {
    let descriptor: number[];
    try {
      descriptor = await this.faceService.getDescriptorFromFile(file.path);
    } catch (e) {
      this.deleteFileIfExists(file.path);
      throw new BadRequestException(
        "Rasmda yuz topilmadi! Aniqroq, yorug' rasmda yuzingiz ko'rinib tursin.",
      );
    }

    this.deleteFileIfExists(student.photoUrl);

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const newFilename = `student_${id}_${Date.now()}${ext}`;
    const newPath = path.join('uploads', 'students', newFilename);
    fs.renameSync(file.path, newPath);

    student.photoUrl = `/${newPath}`;
    student.faceDescriptor = descriptor;

    this.logger.log(`✅ Student ${id} rasmi yangilandi: ${newPath}`);
  }

  try {
    const saved = await this.studentRepo.save(student);
    return this.findOne(saved.id);
  } catch (error) {
    if (error.code === '23505')
      throw new ConflictException("Ma'lumotlar bazasida takrorlanish yuz berdi");
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
    return await this.findOne(id);
  }
}