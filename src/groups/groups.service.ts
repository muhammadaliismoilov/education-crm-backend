import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { Student } from '../entities/students.entity';
import { Invoice } from '../entities/invoice.entity';
import { StudentDiscount } from '../entities/studentDiscount';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  private getCurrentMonthBounds(): { billingMonth: string } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);

    return {
      billingMonth: `${year}-${String(month).padStart(2, '0')}-01`,
    };
  }

  private async recalculateStudentBalance(
    queryRunner: any,
    studentId: string,
  ): Promise<void> {
    const totalPaidRow = await queryRunner.manager
      .createQueryBuilder(Payment, 'p')
      .select('SUM(CAST(p.amount AS DECIMAL))', 'totalPaid')
      .where('p.studentId = :studentId', { studentId })
      .getRawOne();

    const totalInvoicedRow = await queryRunner.manager
      .createQueryBuilder(Invoice, 'i')
      .select('SUM(CAST(i.amount AS DECIMAL))', 'totalInvoiced')
      .where('i.studentId = :studentId', { studentId })
      .getRawOne();

    const totalPaid = Number(totalPaidRow?.totalPaid || 0);
    const totalInvoiced = Number(totalInvoicedRow?.totalInvoiced || 0);

    await queryRunner.manager.update(
      Student,
      { id: studentId },
      { balance: totalPaid - totalInvoiced },
    );
  }

  async create(dto: CreateGroupDto, user: any) {
    await this.checkTeacherAvailability(dto.teacherId, dto.days, dto.startTime);

    const group = this.groupRepo.create({
      ...dto,
      teacher: { id: dto.teacherId },
      branch: dto.branchId
        ? { id: dto.branchId }
        : user.role !== 'superadmin'
          ? { id: user.branchId }
          : null,
    });

    const saved = await this.groupRepo.save(group);

    // SABABI: Yangi guruh yaratildi — audit uchun
    this.logger.log(
      `Guruh yaratildi [id: ${saved.id}] [nomi: ${saved.name}] [teacher: ${dto.teacherId}]`,
    );

    return saved;
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 10,
    user?: any,
    branchId?: string,
  ) {
    const query = this.groupRepo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.teacher', 'teacher')
      .leftJoinAndSelect('group.branch', 'branch')
      .loadRelationCountAndMap('group.studentsCount', 'group.students');

    if (user && user.role === 'teacher') {
      // Teacher faqat o'z guruhlarini ko'rishi kerak
      // branchId bilan birga teacherId bo'yicha ham filter qilinadi
      // shunda paginatsiya faqat o'qituvchining guruhlari soniga asoslanadi
      query.andWhere('teacher.id = :teacherId', { teacherId: user.id });
      query.andWhere('group.branchId = :branchId', { branchId: user.branchId });
    } else if (user && user.role !== 'superadmin') {
      query.andWhere('group.branchId = :branchId', { branchId: user.branchId });
    } else if (branchId) {
      query.andWhere('group.branchId = :branchId', { branchId });
    }

    if (search) {
      query.andWhere('group.name ILike :search', { search: `%${search}%` });
    }

    const [items, total] = await query
      .orderBy('group.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
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
    if (dto.branchId) group.branch = { id: dto.branchId } as any;

    const saved = await this.groupRepo.save(group);

    // SABABI: Guruh o'zgartirildi — audit uchun
    this.logger.log(`Guruh yangilandi [id: ${id}]`);

    return saved;
  }

  async remove(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const group = await queryRunner.manager.findOne(Group, {
        where: { id },
        relations: ['students', 'students.enrolledGroups'],
      });
      if (!group) throw new NotFoundException('Guruh topilmadi');

      // 1. Guruhdan hamma o'quvchilarni chiqaramiz (join table'dan o'chirish uchun Group'ni saqlaymiz)
      const studentsToArchive = [];
      const studentsToCheck = [...group.students]; // nusxa olamiz

      group.students = []; // Hamma o'quvchilarni guruhdan chiqaramiz
      await queryRunner.manager.save(Group, group);

      let archivedStudentsCount = 0;

      // 2. O'quvchilarni birma-bir tekshiramiz: boshqa guruhi qolganmi?
      for (const student of studentsToCheck) {
        // O'quvchining joriy guruhlarini DB dan aniq tekshiramiz
        const studentWithGroups = await queryRunner.manager.findOne(Student, {
          where: { id: student.id },
          relations: ['enrolledGroups'],
        });

        if (
          studentWithGroups &&
          studentWithGroups.enrolledGroups.length === 0
        ) {
          await queryRunner.manager.softRemove(Student, studentWithGroups);
          archivedStudentsCount++;
          this.logger.log(
            `Talaba arxivlandi (guruhi qolmadi) [id: ${student.id}]`,
          );
        }
      }

      group.isActive = false;
      await queryRunner.manager.save(Group, group);
      await queryRunner.manager.softRemove(Group, group);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Guruh arxivlandi [id: ${id}]. ${archivedStudentsCount} ta talaba ham arxivlandi.`,
      );

      return {
        message: 'Guruh arxivlandi',
        archivedStudents: archivedStudentsCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Guruhni arxivlashda xatolik [id: ${id}]`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────
  // ARCHIVED GROUPS HANDLING (SENIOR APPROACH)
  // ─────────────────────────────────────────────
  async findAllDeleted(search?: string, page = 1, limit = 10, user?: any) {
    const query = this.groupRepo
      .createQueryBuilder('group')
      .withDeleted()
      .addSelect('group.deletedAt')
      .leftJoinAndSelect('group.teacher', 'teacher')
      .leftJoinAndSelect('group.branch', 'branch')
      .where('group.deletedAt IS NOT NULL');

    if (user && user.role !== 'superadmin') {
      query.andWhere('group.branchId = :branchId', { branchId: user.branchId });
    }

    if (search) {
      query.andWhere('group.name ILike :search', { search: `%${search}%` });
    }

    const [items, total] = await query
      .orderBy('group.deletedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
    };
  }

  async restore(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    group.isActive = true;
    await this.groupRepo.save(group);
    await this.groupRepo.restore(id);

    this.logger.log(`Guruh arxivdan tiklandi [id: ${id}]`);
    return this.getGroupDetails(id);
  }

  async hardDelete(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!group.deletedAt) {
      throw new BadRequestException(
        "Faqat arxivlangan guruhni butunlay o'chirish mumkin",
      );
    }

    await this.groupRepo.remove(group);
    this.logger.log(`Guruh butunlay o'chirildi [id: ${id}]`);
    return { message: "Guruh butunlay o'chirildi" };
  }

  async addStudentToGroup(groupId: string, studentId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
        relations: ['students', 'branch'],
      });
      if (!group) throw new NotFoundException('Guruh topilmadi');

      const student = await queryRunner.manager.findOne(Student, {
        where: { id: studentId },
      });
      if (!student) throw new NotFoundException('Talaba topilmadi');

      const isAlreadyIn = group.students.some((s) => s.id === studentId);
      if (isAlreadyIn)
        throw new BadRequestException("O'quvchi allaqachon guruhda bor");

      await queryRunner.manager
        .createQueryBuilder()
        .relation(Group, 'students')
        .of(groupId)
        .add(studentId);

      const discount = await queryRunner.manager.findOne(StudentDiscount, {
        where: { student: { id: studentId }, group: { id: groupId } },
      });

      const effectivePrice =
        discount && Number(discount.customPrice) > 0
          ? Number(discount.customPrice)
          : Number(group.price || 0);

      if (effectivePrice > 0) {
        const { billingMonth } = this.getCurrentMonthBounds();
        const existingThisMonth = await queryRunner.manager.findOne(Invoice, {
          where: {
            student: { id: studentId },
            group: { id: groupId },
            type: 'monthly_fee',
            billingMonth,
          },
        });

        if (!existingThisMonth) {
          const invoice = queryRunner.manager.create(Invoice, {
            amount: effectivePrice,
            type: 'monthly_fee',
            billingMonth,
            student: { id: studentId },
            group: { id: groupId },
            branch: group.branch ? { id: group.branch.id } : null,
          });
          await queryRunner.manager.save(invoice);
        }
      }

      await this.recalculateStudentBalance(queryRunner, studentId);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Guruhga qo'shishda hisob-kitob xatosi", err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(
      `Talaba guruhga qo'shildi va to'lov yozildi [group: ${groupId}] [student: ${studentId}]`,
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
