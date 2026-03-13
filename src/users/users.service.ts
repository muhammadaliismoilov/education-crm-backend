import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const isExisting = await this.userRepo.findOne({
      where: [{ login: dto.login }, { phone: dto.phone }],
      withDeleted: true,
    });

    if (isExisting) {
      // TUZATISH: Qaysi maydon band ekanini aniq aytish
      if (isExisting.login === dto.login)
        throw new ConflictException('Ushbu login allaqachon mavjud');
      if (isExisting.phone === dto.phone)
        throw new ConflictException('Ushbu telefon raqami allaqachon mavjud');
    }

    const newUser = this.userRepo.create(dto);
    const saved = await this.userRepo.save(newUser);

    // SABABI: Kim yaratilganini audit uchun — foydalanuvchi yaratish muhim harakat
    this.logger.log(
      `Foydalanuvchi yaratildi [id: ${saved.id}] [login: ${saved.login}] [role: ${saved.role}]`,
    );

    return saved;
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
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    // TUZATISH: login/phone o'zgarsa conflict tekshiruvi kerak
    if (dto.login || dto.phone) {
      const conflictCheck = await this.userRepo.findOne({
        where: [
          ...(dto.login ? [{ login: dto.login }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
        withDeleted: true,
      });
      if (conflictCheck && conflictCheck.id !== id) {
        if (dto.login && conflictCheck.login === dto.login)
          throw new ConflictException(
            'Ushbu login boshqa foydalanuvchida band',
          );
        if (dto.phone && conflictCheck.phone === dto.phone)
          throw new ConflictException(
            'Ushbu telefon raqami boshqa foydalanuvchida band',
          );
      }
    }

    // TUZATISH: password hash qilingandan keyin dto ni o'zgartirish xavfli —
    // alohida object yasash kerak, asl dto ni buzmaslik uchun
    const updateData: Partial<UpdateUserDto> = { ...dto };
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    await this.userRepo.update(id, updateData);

    // SABABI: Kim o'zgartirildi, qaysi rolda — audit uchun
    this.logger.log(`Foydalanuvchi yangilandi [id: ${id}]`);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.softRemove(user);

    // SABABI: O'chirish qaytarib bo'lmaydigan harakat — kim o'chirildi audit uchun
    this.logger.log(
      `Foydalanuvchi arxivlandi [id: ${user.id}] [login: ${user.login}]`,
    );
  }

  async findAllDeleted(search?: string, page = 1, limit = 10) {
    const query = this.userRepo
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.deletedAt IS NOT NULL');

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

    // SABABI: Qayta tiklash ham audit uchun muhim
    this.logger.log(`Foydalanuvchi qayta tiklandi [id: ${id}]`);

    return this.findOne(id);
  }
}
