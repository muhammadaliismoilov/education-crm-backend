import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expenses.dto';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  async create(dto: CreateExpenseDto, actor: any): Promise<Expense> {
    const branchId =
      actor.role === UserRole.SUPERADMIN ? dto.branchId : actor.branchId;

    const expense = this.expenseRepo.create({
      amount: dto.amount,
      description: dto.description,
      expenseDate:
        dto.expenseDate ?? new Date().toISOString().split('T')[0],
      createdById: actor.id,
      branchId: branchId || null,
    });

    const saved = await this.expenseRepo.save(expense);
    this.logger.log(
      `Xarajat yaratildi [id: ${saved.id}] [amount: ${saved.amount}] [by: ${actor.id}]`,
    );
    return this.findOne(saved.id, actor);
  }

  async findAll(filter: ExpenseFilterDto, actor: any) {
    const { page = 1, limit = 10, month, year } = filter;

    const query = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.createdBy', 'creator')
      .where('e.deletedAt IS NULL');

    // Branch filtratsiyasi
    if (actor.role !== UserRole.SUPERADMIN) {
      query.andWhere('e.branchId = :branchId', { branchId: actor.branchId });
    } else if (filter.branchId) {
      query.andWhere('e.branchId = :branchId', { branchId: filter.branchId });
    }

    // Oylik filter (YYYY-MM)
    if (month) {
      const [y, m] = month.split('-');
      query.andWhere(
        `EXTRACT(YEAR FROM e."createdAt") = :y AND EXTRACT(MONTH FROM e."createdAt") = :m`,
        { y: parseInt(y), m: parseInt(m) },
      );
    }
    // Yillik filter
    else if (year) {
      query.andWhere(`EXTRACT(YEAR FROM e."createdAt") = :year`, {
        year: parseInt(year),
      });
    }

    const [items, total] = await query
      .orderBy('e.createdAt', 'DESC')
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

  async findOne(id: string, actor: any): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: ['createdBy', 'branch'],
    });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');

    // Branch tekshiruvi (superadmin hamma narsani ko'ra oladi)
    if (
      actor.role !== UserRole.SUPERADMIN &&
      expense.branchId !== actor.branchId
    ) {
      throw new NotFoundException('Xarajat topilmadi');
    }

    return expense;
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    actor: any,
  ): Promise<Expense> {
    await this.findOne(id, actor); // mavjudligini va ruxsatni tekshiradi

    await this.expenseRepo.update(id, {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.expenseDate !== undefined && { expenseDate: dto.expenseDate }),
    });

    this.logger.log(`Xarajat yangilandi [id: ${id}] [by: ${actor.id}]`);
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: any): Promise<void> {
    const expense = await this.findOne(id, actor);
    await this.expenseRepo.softRemove(expense);
    this.logger.log(`Xarajat arxivlandi (soft delete) [id: ${id}] [by: ${actor.id}]`);
  }

  async findAllDeleted(filter: ExpenseFilterDto, actor: any) {
    const { page = 1, limit = 10, month, year } = filter;

    const query = this.expenseRepo
      .createQueryBuilder('e')
      .withDeleted()
      .leftJoinAndSelect('e.createdBy', 'creator')
      .where('e.deletedAt IS NOT NULL');

    // Branch filtratsiyasi
    if (actor.role !== UserRole.SUPERADMIN) {
      query.andWhere('e.branchId = :branchId', { branchId: actor.branchId });
    } else if (filter.branchId) {
      query.andWhere('e.branchId = :branchId', { branchId: filter.branchId });
    }

    if (month) {
      const [y, m] = month.split('-');
      query.andWhere(
        `EXTRACT(YEAR FROM e."createdAt") = :y AND EXTRACT(MONTH FROM e."createdAt") = :m`,
        { y: parseInt(y), m: parseInt(m) },
      );
    } else if (year) {
      query.andWhere(`EXTRACT(YEAR FROM e."createdAt") = :year`, {
        year: parseInt(year),
      });
    }

    const [items, total] = await query
      .orderBy('e.deletedAt', 'DESC')
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

  async restore(id: string, actor: any): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['branch'],
    });

    if (!expense) throw new NotFoundException('Xarajat topilmadi');

    if (
      actor.role !== UserRole.SUPERADMIN &&
      expense.branchId !== actor.branchId
    ) {
      throw new NotFoundException('Xarajat topilmadi');
    }

    await this.expenseRepo.restore(id);
    this.logger.log(`Xarajat qayta tiklandi [id: ${id}] [by: ${actor.id}]`);
    
    return this.expenseRepo.findOne({
      where: { id },
      relations: ['createdBy', 'branch'],
    }) as Promise<Expense>;
  }

  async hardDelete(id: string, actor: any): Promise<void> {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['branch'],
    });

    if (!expense) throw new NotFoundException('Xarajat topilmadi');

    if (
      actor.role !== UserRole.SUPERADMIN &&
      expense.branchId !== actor.branchId
    ) {
      throw new NotFoundException('Xarajat topilmadi');
    }

    if (!expense.deletedAt) {
      throw new ForbiddenException("Faqat arxivlangan xarajatni butunlay o'chirish mumkin");
    }

    await this.expenseRepo.remove(expense);
    this.logger.log(`Xarajat butunlay o'chirildi [id: ${id}] [by: ${actor.id}]`);
  }


  // Dashboard / Analytics uchun jami xarajat hisoblash
  async getTotalExpenses(
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<number> {
    const query = this.expenseRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.deletedAt IS NULL')
      .andWhere('e.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });

    if (branchId) {
      query.andWhere('e.branchId = :branchId', { branchId });
    }

    const res = await query.getRawOne();
    return Number(res?.total) || 0;
  }
}
