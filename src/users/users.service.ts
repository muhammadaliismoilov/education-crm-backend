import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.repo.findOne({ where: [{ login: dto.login }, { phone: dto.phone }] });
    
    if (existing) throw new ConflictException('Login yoki telefon allaqachon mavjud');
    console.log(dto);
    
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({ ...dto, password: hashedPassword });
    return await this.repo.save(user);
  }

  async findAll(role?: UserRole, search?: string) {
  const query: any = {};
  if (role) query.role = role;
  if (search) query.fullName = ILike(`%${search}%`);

  return await this.repo.find({
    where: query,
    order: { createdAt: 'DESC' },
  });
}

  async findOne(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async update(id: string, dto: Partial<UpdateUserDto>) {
    const user = await this.findOne(id);
    if (dto.password) dto.password = await bcrypt.hash(dto.password, 10);
    Object.assign(user, dto);
    return await this.repo.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return await this.repo.remove(user);
  }
}