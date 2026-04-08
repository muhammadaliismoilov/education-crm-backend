import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In, Between } from 'typeorm';
import { DocumentType, Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';
import { StudentDiscount } from '../entities/studentDiscount';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
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
    private dataSource: DataSource,
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
      this.logger.warn(
        `Rasmni o'chirishda xatolik [${cleanPath}]: ${e.message}`,
      );
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

  private getCurrentMonthBounds(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  private async recalculateStudentBalance(studentId: string): Promise<void> {
    const paidRow = await this.dataSource.manager
      .createQueryBuilder(Payment, 'p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId })
      .getRawOne();

    const invoicedRow = await this.dataSource.manager
      .createQueryBuilder(Invoice, 'i')
      .select('SUM(CAST(i.amount AS DECIMAL))', 'totalInvoiced')
      .where('i.studentId = :studentId', { studentId })
      .getRawOne();

    const totalPaid = Number(paidRow?.totalPaid || 0);
    const totalInvoiced = Number(invoicedRow?.totalInvoiced || 0);

    await this.studentRepo.update(
      { id: studentId },
      { balance: totalPaid - totalInvoiced },
    );
  }

  // ─────────────────────────────────────────────
  // HELPER — rasm saqlash (create va update uchun umumiy)
  // ─────────────────────────────────────────────
  private async verifyFace(file: Express.Multer.File): Promise<number[]> {
    try {
      return await this.faceService.getDescriptorFromFile(file.path);
    } catch (e) {
      this.deleteFileIfExists(file.path);
      this.logger.warn(`Yuz topilmadi, temp fayl o'chirildi: ${file.path}`);
      throw new BadRequestException(
        "Rasmda yuz topilmadi! Aniqroq, yorug' rasmda yuzingiz ko'rinib tursin.",
      );
    }
  }

  // ─────────────────────────────────────────────
  // HELPER — rasmni yakuniy manzilga ko'chirish
  // ─────────────────────────────────────────────
  private movePhoto(
    file: Express.Multer.File,
    studentId: string,
    oldPhotoUrl?: string | null,
  ): string {
    // Eski rasmni o'chirish
    if (oldPhotoUrl) this.deleteFileIfExists(oldPhotoUrl);

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const newFilename = `student_${studentId}_${Date.now()}${ext}`;
    const newPath = path.join('uploads', 'students', newFilename);
    fs.renameSync(file.path, newPath);

    this.logger.log(`Rasm saqlandi [student: ${studentId}]: ${newPath}`);
    return `/${newPath}`;
  }

  // ─────────────────────────────────────────────
  // 1. CREATE
  // ─────────────────────────────────────────────

  async create(dto: CreateStudentDto, user: any, file?: Express.Multer.File) {
    let faceDescriptor: number[] | undefined;
    if (file) {
      faceDescriptor = await this.verifyFace(file);
    }

    try {
      const { groupIds, pinfl, documentNumber, discounts, ...studentData } =
        dto;

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
        branch:
          user.role === 'superadmin' && dto.branchId
            ? { id: dto.branchId }
            : { id: user.branchId },
      });

      let saved = await this.studentRepo.save(student);
      this.logger.log(
        `Yangi talaba yaratildi [id: ${saved.id}] [tel: ${saved.phone}]`,
      );

      // Discountlarni saqlash
      if (discounts && discounts.length > 0) {
        for (const discountDto of discounts) {
          const { groupId, customPrice } = discountDto;
          if (customPrice === null || customPrice === undefined) continue;

          const group = groups.find((g) => g.id === groupId);
          if (!group) continue;

          if (customPrice >= Number(group.price))
            throw new BadRequestException(
              `Imtiyozli narx ${Number(group.price).toLocaleString()} so'mdan kichik bo'lishi kerak`,
            );
          if (customPrice < 0)
            throw new BadRequestException(
              "Narx 0 dan kichik bo'lishi mumkin emas",
            );

          const newDiscount = this.discountRepo.create({
            student: { id: saved.id },
            group: { id: groupId },
            customPrice,
          });
          await this.discountRepo.save(newDiscount);
          this.logger.log(
            `Imtiyoz saqlandi [student: ${saved.id}] [group: ${groupId}] [narx: ${customPrice}]`,
          );
        }
      }

      // Invoice (Birinchi oylik to'lovni yozish)
      let initialBalanceDebt = 0;
      for (const group of groups) {
        const discount = discounts?.find((d) => d.groupId === group.id);
        const effectivePrice =
          discount && Number(discount.customPrice) > 0
            ? Number(discount.customPrice)
            : Number(group.price || 0);

        if (effectivePrice > 0) {
          const invoice = this.dataSource.manager.create(Invoice, {
            amount: effectivePrice,
            type: 'monthly_fee',
            student: { id: saved.id },
            group: { id: group.id },
          });
          await this.dataSource.manager.save(invoice);
          initialBalanceDebt += effectivePrice;
        }
      }

      if (initialBalanceDebt > 0) {
        saved.balance = -initialBalanceDebt;
        saved = await this.studentRepo.save(saved);
        this.logger.log(
          `Birinchi oylik qarzlar belgilandi: -${initialBalanceDebt} [student: ${saved.id}]`,
        );
      }

      if (file && faceDescriptor) {
        saved.photoUrl = this.movePhoto(file, saved.id);
        saved.faceDescriptor = faceDescriptor;
        saved = await this.studentRepo.save(saved);
      }

      return await this.findOne(saved.id);
    } catch (error) {
      this.deleteFileIfExists(file?.path);
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi.",
        );
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
  async findAll(
    search?: string,
    groupName?: string,
    page = 1,
    limit = 10,
    user?: any,
    branchId?: string,
  ) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.enrolledGroups', 'group')
      .leftJoinAndSelect('student.discounts', 'discount')
      .leftJoinAndSelect('student.branch', 'branch')
      .leftJoinAndSelect('discount.group', 'discountGroup');

    if (user && user.role !== 'superadmin') {
      query.andWhere('student.branchId = :branchId', {
        branchId: user.branchId,
      });
    } else if (branchId) {
      query.andWhere('student.branchId = :branchId', { branchId });
    }

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
  async findOne(id: string, user?: any) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: [
        'enrolledGroups',
        'payments',
        'attendances',
        'discounts',
        'discounts.group',
        'branch',
      ],
    });
    if (!student) throw new NotFoundException('Student topilmadi');
    if (
      user &&
      user.role !== 'superadmin' &&
      student.branch?.id !== user.branchId
    ) {
      throw new NotFoundException('Student topilmadi');
    }
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
    user: any,
    file?: Express.Multer.File,
  ) {
    let faceDescriptor: number[] | undefined;
    if (file) {
      faceDescriptor = await this.verifyFace(file);
    }

    try {
      const student = await this.studentRepo.findOne({
        where: { id },
        relations: ['enrolledGroups', 'branch'],
      });

      if (!student) {
        throw new NotFoundException('Student topilmadi');
      }

      // Senior Level: Multi-tenant xavfsizlik tekshiruvi
      if (user.role !== 'superadmin' && student.branch?.id !== user.branchId) {
        throw new NotFoundException(
          "Student topilmadi yoki unga ruxsatingiz yo'q",
        );
      }

      const {
        groupIds,
        pinfl,
        documentNumber,
        phone,
        discounts,
        branchId,
        ...updateData
      } = dto;

      // Faqat superadmin filialni o'zgartira oladi
      if (user.role !== 'superadmin' && branchId) {
        this.logger.warn(
          `Filialni o'zgartirishga urinish rad etildi: Foydalanuvchi [${user.id}]`,
        );
        // branchId'ni e'tiborsiz qoldiramiz
      }

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
            throw new ConflictException(
              "Ushbu telefon raqami boshqa o'quvchida band",
            );
          if (pinfl?.trim() && conflictCheck.pinfl === pinfl)
            throw new ConflictException("Ushbu PINFL boshqa o'quvchida band");
          if (
            documentNumber?.trim() &&
            conflictCheck.documentNumber === documentNumber
          )
            throw new ConflictException(
              "Ushbu hujjat raqami boshqa o'quvchida band",
            );
        }
      }

      let newGroupsToCharge: Group[] = [];
      let needsBalanceRecalc = false;
      if (groupIds && groupIds.length > 0) {
        const groups = await this.groupRepo.findBy({ id: In(groupIds) });
        if (groups.length !== groupIds.length)
          throw new NotFoundException(
            'Bir yoki bir nechta tanlangan guruhlar topilmadi',
          );

        const oldGroupIds = new Set(student.enrolledGroups.map((g) => g.id));
        newGroupsToCharge = groups.filter((g) => !oldGroupIds.has(g.id));

        student.enrolledGroups = groups;
        if (!dto.direction?.trim()) student.direction = groups[0].name;
      }

      if (user.role === 'superadmin' && branchId) {
        student.branch = { id: branchId } as any;
      }

      student.fullName = this.keepIfEmpty(
        updateData.fullName,
        student.fullName,
      );
      student.phone = this.keepIfEmpty(phone, student.phone);
      student.parentName = this.keepIfEmpty(
        updateData.parentName,
        student.parentName,
      );
      student.parentPhone = this.keepIfEmpty(
        updateData.parentPhone,
        student.parentPhone,
      );
      student.pinfl = this.keepIfEmpty(pinfl, student.pinfl);
      student.documentNumber = this.keepIfEmpty(
        documentNumber,
        student.documentNumber,
      );
      student.direction = this.keepIfEmpty(
        updateData.direction,
        student.direction,
      );

      if (updateData.documentType?.trim())
        student.documentType = updateData.documentType as DocumentType;
      if (updateData.birthDate?.trim())
        student.birthDate = new Date(updateData.birthDate);

      if (discounts && discounts.length > 0) {
        for (const discountDto of discounts) {
          const { groupId, customPrice } = discountDto;
          const isInGroup = student.enrolledGroups.some(
            (g) => g.id === groupId,
          );
          if (!isInGroup)
            throw new BadRequestException('Talaba bu guruhda emas!');

          const group = await this.groupRepo.findOne({
            where: { id: groupId },
          });
          if (!group) throw new NotFoundException('Guruh topilmadi');

          const existing = await this.discountRepo.findOne({
            where: { student: { id }, group: { id: groupId } },
          });

          if (customPrice === null || customPrice === undefined) {
            if (existing) {
              await this.discountRepo.remove(existing);
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
            this.logger.log(
              `Imtiyoz yangilandi [student: ${id}] [group: ${groupId}] [narx: ${customPrice}]`,
            );
          }
        }
      }

      // Yangi qo'shilgan guruhlar uchun initial invoice
      if (newGroupsToCharge.length > 0) {
        const { start, end } = this.getCurrentMonthBounds();
        for (const group of newGroupsToCharge) {
          const discount = discounts?.find((d) => d.groupId === group.id);
          const effectivePrice =
            discount && Number(discount.customPrice) > 0
              ? Number(discount.customPrice)
              : Number(group.price || 0);

          if (effectivePrice > 0) {
            const existingThisMonth = await this.dataSource.manager.findOne(
              Invoice,
              {
                where: {
                  student: { id },
                  group: { id: group.id },
                  type: 'monthly_fee',
                  createdAt: Between(start, end),
                },
              },
            );

            if (!existingThisMonth) {
              const invoice = this.dataSource.manager.create(Invoice, {
                amount: effectivePrice,
                type: 'monthly_fee',
                student: { id },
                group: { id: group.id },
              });
              await this.dataSource.manager.save(invoice);
              needsBalanceRecalc = true;
            }
          }
        }
      }

      // SENIOR APPROACH: Photo & Biometric Integrity
      // 1. Agar rasm butunlay o'chirilsa
      if (dto.removePhoto === true) {
        if (student.photoUrl) {
          this.deleteFileIfExists(student.photoUrl);
          student.photoUrl = null;
          student.faceDescriptor = null;
          this.logger.log(
            `Rasm va biometrik ma'lumotlar o'chirildi [student: ${id}]`,
          );
        }
      }
      // 2. Agar yangi rasm yuklansa (bundan avvalgi logika bilan birga)
      else if (file && faceDescriptor) {
        student.photoUrl = this.movePhoto(file, id, student.photoUrl);
        student.faceDescriptor = faceDescriptor;
        this.logger.log(
          `Rasm va biometrik ma'lumotlar yangilandi [student: ${id}]`,
        );
      }

      const saved = await this.studentRepo.save(student);
      if (needsBalanceRecalc) {
        await this.recalculateStudentBalance(saved.id);
      }
      this.logger.log(`Talaba muvaffaqiyatli yangilandi [id: ${id}]`);
      return await this.findOne(saved.id);
    } catch (error) {
      this.deleteFileIfExists(file?.path);
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error.code === '23505')
        throw new ConflictException(
          "Ma'lumotlar bazasida takrorlanish yuz berdi",
        );
      this.logger.error(`Talaba yangilashda xatolik [id: ${id}]`, error.stack);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // 5. REMOVE
  // ─────────────────────────────────────────────
  async remove(id: string, user: any) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: ['branch'],
    });
    if (!student) throw new NotFoundException('Student topilmadi');

    if (user.role !== 'superadmin' && student.branch?.id !== user.branchId) {
      throw new NotFoundException("Student topilmadi (ruxsat yo'q)");
    }

    await this.studentRepo.softRemove(student);
    // SABABI: O'chirish — qaytarib bo'lmaydigan harakat, kim o'chirgani audit uchun muhim
    this.logger.log(`Talaba arxivlandi [id: ${id}] [tel: ${student.phone}]`);
    return { success: true, message: "O'quvchi muvaffaqiyatli arxivlandi" };
  }

  // ─────────────────────────────────────────────
  // 6. FIND DELETED
  // ─────────────────────────────────────────────
  async findAllDeleted(search?: string, page = 1, limit = 10, user?: any) {
    const query = this.studentRepo
      .createQueryBuilder('student')
      .withDeleted()
      .leftJoinAndSelect('student.enrolledGroups', 'groups')
      .where('student.deletedAt IS NOT NULL');

    if (user && user.role !== 'superadmin') {
      query.andWhere('student.branchId = :branchId', {
        branchId: user.branchId,
      });
    }

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
  async restore(id: string, user: any) {
    const student = await this.studentRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['branch'],
    });
    if (!student) throw new NotFoundException('Student topilmadi');

    if (user.role !== 'superadmin' && student.branch?.id !== user.branchId) {
      throw new NotFoundException("Student topilmadi (ruxsat yo'q)");
    }

    await this.studentRepo.restore(id);
    // SABABI: Qayta tiklash ham audit uchun muhim harakat
    this.logger.log(`Talaba qayta tiklandi [id: ${id}]`);
    return await this.findOne(id, user); // Userni findOne'ga ham berdik
  }

  // ─────────────────────────────────────────────
  // 8. HARD DELETE (permanent)
  // ─────────────────────────────────────────────
  async hardDelete(id: string, user: any) {
    const student = await this.studentRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['branch'],
    });
    if (!student) throw new NotFoundException('Student topilmadi');

    if (user.role !== 'superadmin' && student.branch?.id !== user.branchId) {
      throw new NotFoundException("Student topilmadi (ruxsat yo'q)");
    }

    if (!student.deletedAt) {
      throw new BadRequestException(
        "Faqat arxivlangan talabani butunlay o'chirish mumkin",
      );
    }

    if (student.photoUrl) {
      this.deleteFileIfExists(student.photoUrl);
    }

    await this.studentRepo.remove(student);
    this.logger.log(
      `Talaba butunlay o'chirildi [id: ${id}] [tel: ${student.phone}]`,
    );
    return { success: true, message: "Talaba butunlay o'chirildi" };
  }
}
