import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentType, Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';
import { StudentDiscount } from '../entities/studentDiscount';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(StudentDiscount) private discountRepo: Repository<StudentDiscount>, 
  ) {}

  
  // 1. CREATE — faqat oddiy talaba, imtiyozsiz
  async create(dto: CreateStudentDto) {
    const { groupIds, pinfl, documentNumber, ...studentData } = dto;

    // 1. Unikal maydonlarni tekshirish
    const existing = await this.studentRepo.findOne({
      where: [
        { phone: dto.phone },
        ...(pinfl ? [{ pinfl }] : []),
        ...(documentNumber ? [{ documentNumber }] : []),
      ],
    });

    if (existing) {
      if (existing.phone === dto.phone)
        throw new ConflictException("Ushbu telefon raqamli o'quvchi allaqachon mavjud");
      if (pinfl && existing.pinfl === pinfl)
        throw new ConflictException("Ushbu JSHSHIR (PINFL) raqamli o'quvchi allaqachon mavjud");
      if (documentNumber && existing.documentNumber === documentNumber)
        throw new ConflictException("Ushbu seria raqamli o'quvchi allaqachon mavjud");
    }

    // 2. Guruhlar borligini tekshirish
    const groups = await this.groupRepo.findBy({ id: In(groupIds) });
    if (groups.length !== groupIds.length) {
      throw new NotFoundException('Bir yoki bir nechta tanlangan guruhlar topilmadi');
    }

    // 3. Student yaratish — imtiyozsiz, oddiy talaba
    const student = this.studentRepo.create({
      fullName: studentData.fullName,
      phone: studentData.phone,
      parentName: studentData.parentName,
      parentPhone: studentData.parentPhone,
      documentNumber,
      pinfl,
      birthDate: studentData.birthDate ? new Date(studentData.birthDate) : undefined,
      documentType: studentData.documentType as DocumentType,
      direction: dto.direction || (groups.length > 0 ? groups[0].name : undefined),
      enrolledGroups: groups, // ManyToMany — oddiy
    });

    try {
      return await this.studentRepo.save(student);
    } catch (error) {
      if (error.code === '23505')
        throw new ConflictException("Ma'lumotlar bazasida takrorlanish yuz berdi.");
      throw error;
    }
  }

  // 2. FIND ALL
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

  // 3. FIND ONE
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

  // 4. UPDATE — imtiyoz ham shu yerda beriladi
  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: ['enrolledGroups'],
    });
    if (!student) throw new NotFoundException('Student topilmadi');

    const { groupIds, pinfl, documentNumber, phone, discounts, ...updateData } = dto;

    // 1. Unikal maydonlar tekshiruvi
    if (phone || pinfl || documentNumber) {
      const conflictCheck = await this.studentRepo.findOne({
        where: [
          ...(phone ? [{ phone }] : []),
          ...(pinfl ? [{ pinfl }] : []),
          ...(documentNumber ? [{ documentNumber }] : []),
        ],
      });

      if (conflictCheck && conflictCheck.id !== id) {
        if (phone && conflictCheck.phone === phone)
          throw new ConflictException("Ushbu telefon raqami boshqa o'quvchida band");
        if (pinfl && conflictCheck.pinfl === pinfl)
          throw new ConflictException("Ushbu PINFL boshqa o'quvchida band");
        if (documentNumber && conflictCheck.documentNumber === documentNumber)
          throw new ConflictException("Ushbu hujjat raqami boshqa o'quvchida band");
      }
    }

    // 2. Guruhlarni yangilash
    if (groupIds && groupIds.length > 0) {
      const groups = await this.groupRepo.findBy({ id: In(groupIds) });
      if (groups.length !== groupIds.length)
        throw new NotFoundException('Bir yoki bir nechta tanlangan guruhlar topilmadi');
      student.enrolledGroups = groups;
      if (!dto.direction) student.direction = groups[0].name;
    }

    // 3. Asosiy maydonlarni yangilash
    student.fullName = updateData.fullName ?? student.fullName;
    student.phone = phone ?? student.phone;
    student.parentName = updateData.parentName ?? student.parentName;
    student.parentPhone = updateData.parentPhone ?? student.parentPhone;
    student.pinfl = pinfl ?? student.pinfl;
    student.documentNumber = documentNumber ?? student.documentNumber;
    student.direction = updateData.direction ?? student.direction;

    if (updateData.documentType)
      student.documentType = updateData.documentType as DocumentType;
    if (updateData.birthDate)
      student.birthDate = new Date(updateData.birthDate);

    // 4.  IMTIYOZ YANGILASH
    if (discounts && discounts.length > 0) {
      for (const discountDto of discounts) {
        const { groupId, customPrice } = discountDto;

        // Talaba bu guruhda borligini tekshirish
        const isInGroup = student.enrolledGroups.some((g) => g.id === groupId);
        if (!isInGroup)
          throw new BadRequestException(`Talaba bu guruhda emas!`);

        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Guruh topilmadi');

        // Mavjud imtiyozni qidiramiz
        const existing = await this.discountRepo.findOne({
          where: { student: { id }, group: { id: groupId } },
        });

        if (customPrice === null || customPrice === undefined) {
          //  null — imtiyozni bekor qilish
          if (existing) await this.discountRepo.remove(existing);
        } else {
          // Narx validatsiyasi
          if (customPrice >= Number(group.price))
            throw new BadRequestException(
              `Imtiyozli narx ${Number(group.price).toLocaleString()} so'mdan kichik bo'lishi kerak`,
            );
          if (customPrice < 0)
            throw new BadRequestException("Narx 0 dan kichik bo'lishi mumkin emas");

          if (existing) {
            //  Bor — yangilash
            existing.customPrice = customPrice;
            await this.discountRepo.save(existing);
          } else {
            //  Yo'q — yaratish
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

    try {
      const saved = await this.studentRepo.save(student);
      return this.findOne(saved.id); //  discounts bilan qaytarish
    } catch (error) {
      if (error.code === '23505')
        throw new ConflictException("Ma'lumotlar bazasida takrorlanish yuz berdi");
      throw error;
    }
  }

  // 5. REMOVE, RESTORE, FIND DELETED
  async remove(id: string) {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException('Student topilmadi');
    await this.studentRepo.softRemove(student);
    return { success: true, message: "O'quvchi muvaffaqiyatli arxivlandi" };
  }

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

  async restore(id: string) {
    await this.studentRepo.restore(id);
    return await this.findOne(id);
  }

  // HELPER — effectivePrice hisoblash
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
            ? Number(discount.customPrice)  // imtiyozli narx
            : Number(group.price),          // standart narx
          hasDiscount: !!discount,
        };
      }),
    };
  }
}