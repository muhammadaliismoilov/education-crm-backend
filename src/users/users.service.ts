import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

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
      relations: ['teachingGroups'],
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // 1. Foydalanuvchi borligini tekshiramiz
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    await this.userRepo.update(id, dto);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    // Soft Remove - ma'lumot bazada qoladi, lekin deletedAt belgilanadi
    await this.userRepo.softRemove(user);
  }
async findAllDeleted(search?: string, page = 1, limit = 10) {
  // withDeleted() hammasini olib keladi
  const query = this.userRepo.createQueryBuilder('user').withDeleted();

  // FAQAT o'chirilganlarni saralab olamiz
  query.andWhere('user.deletedAt IS NOT NULL');

  if (search) {
    query.andWhere(
      '(user.fullName ILike :search OR user.phone ILike :search OR user.login ILike :search)',
      { search: `%${search}%` },
    );
  }

  const [items, total] = await query
    .orderBy('user.deletedAt', 'DESC')
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

  async restore(id: string): Promise<User> {
    await this.userRepo.restore(id);
    return this.findOne(id);
  }
}
