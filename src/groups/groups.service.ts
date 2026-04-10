import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { Between, DataSource, Repository } from 'typeorm';
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

    if (user && user.role !== 'superadmin') {
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
    const group = await this.getGroupDetails(id);
    await this.groupRepo.softRemove(group);

    // SABABI: Arxivlash qaytarib bo'lmaydigan harakat — audit uchun
    this.logger.log(`Guruh arxivlandi [id: ${id}] [nomi: ${group.name}]`);

    return { message: 'Guruh arxivlandi' };
  }

  async addStudentToGroup(groupId: string, studentId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
        relations: ['students'],
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
        const { start, end } = this.getCurrentMonthBounds();
        const existingThisMonth = await queryRunner.manager.findOne(Invoice, {
          where: {
            student: { id: studentId },
            group: { id: groupId },
            type: 'monthly_fee',
            createdAt: Between(start, end),
          },
        });

        if (!existingThisMonth) {
          const invoice = queryRunner.manager.create(Invoice, {
            amount: effectivePrice,
            type: 'monthly_fee',
            student: { id: studentId },
            group: { id: groupId },
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
