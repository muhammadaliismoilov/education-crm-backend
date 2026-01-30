import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateUserDto, UpdateUserDto } from './users.dto';
import { User, UserRole } from 'src/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const isExisting = await this.userRepo.findOne({
      where: [{ login: dto.login }, { phone: dto.phone }],
      withDeleted: true, // O'chirilganlar orasida ham tekshiramiz
    });

    if (isExisting) {
      throw new ConflictException(
        'Ushbu login yoki telefon raqami allaqachon mavjud',
      );
    }

    const newUser = this.userRepo.create(dto);
    return await this.userRepo.save(newUser);
  }

  async findAll(role?: UserRole, search?: string, page = 1, limit = 10) {
    const query = this.userRepo.createQueryBuilder('user');

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (search) {
      query.andWhere(
        '(user.fullName ILike :search OR user.phone ILike :search OR user.login ILike :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await query
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['enrolledGroups', 'teachingGroups'],
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Patch mantiqi: Faqat kelgan maydonlarni o'zgartiramiz
    Object.assign(user, dto);
    return await this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    // Soft Remove - ma'lumot bazada qoladi, lekin deletedAt belgilanadi
    await this.userRepo.softRemove(user);
  }

  async restore(id: string): Promise<User> {
    await this.userRepo.restore(id);
    return this.findOne(id);
  }
}
