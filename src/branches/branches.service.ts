import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { User, UserRole } from '../entities/user.entity';
import {
  CreateBranchDto,
  UpdateBranchDto,
  CreateBranchWithAdminDto,
  UpdateBranchLocationDto,
  ToggleTeacherManualAttendanceDto,
} from './branches.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ────────────────────────────────────────────────────────────
  // 1. Oddiy filial yaratish
  // ────────────────────────────────────────────────────────────
  async create(dto: CreateBranchDto) {
    const branch = this.branchRepo.create(dto);
    return this.branchRepo.save(branch);
  }

  // ────────────────────────────────────────────────────────────
  // 2. Filial + Admin BIRGA yaratish (tranzaksiya ichida)
  // ────────────────────────────────────────────────────────────
  async createWithAdmin(dto: CreateBranchWithAdminDto) {
    // Login yoki subdomain band emasligini oldindan tekshirish
    const existingLogin = await this.userRepo.findOne({
      where: { login: dto.adminLogin },
      withDeleted: true,
    });
    if (existingLogin) {
      throw new ConflictException(`"${dto.adminLogin}" login allaqachon band`);
    }

    if (dto.subdomain) {
      const existingSubdomain = await this.branchRepo.findOne({
        where: { subdomain: dto.subdomain },
        withDeleted: true,
      });
      if (existingSubdomain) {
        throw new ConflictException(
          `"${dto.subdomain}" subdomen allaqachon ishlatilmoqda`,
        );
      }
    }

    // Tranzaksiya — ikkalasi birga saqlanadi, biri muvaffaqiyatsiz bo'lsa rollback
    return this.dataSource.transaction(async (manager) => {
      // Filialni yaratish
      const branch = manager.create(Branch, {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        subdomain: dto.subdomain,
        customDomain: dto.customDomain,
        isActive: true,
      });
      const savedBranch = await manager.save(branch);

      // Admin foydalanuvchini yaratish
      const admin = manager.create(User, {
        fullName: dto.adminFullName,
        login: dto.adminLogin,
        phone: dto.adminPhone,
        password: dto.adminPassword, // @BeforeInsert hook hash qiladi
        role: UserRole.ADMIN,
        branch: { id: savedBranch.id },
      });
      const savedAdmin = await manager.save(admin);

      this.logger.log(
        `Yangi filial + admin yaratildi: branch[${savedBranch.id}] admin[${savedAdmin.id}]`,
      );

      return {
        branch: savedBranch,
        admin: {
          id: savedAdmin.id,
          fullName: savedAdmin.fullName,
          login: savedAdmin.login,
          role: savedAdmin.role,
        },
      };
    });
  }

  // ────────────────────────────────────────────────────────────
  // 3. Barcha filiallar
  // ────────────────────────────────────────────────────────────
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, totalItems] = await this.branchRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      data,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        itemsPerPage: Number(limit),
      },
    };
  }

  // ────────────────────────────────────────────────────────────
  // 4. Bitta filial
  // ────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const branch = await this.branchRepo.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!branch) throw new NotFoundException('Branch Topilmadi');
    return branch;
  }

  // ────────────────────────────────────────────────────────────
  // 5. Yangilash
  // ────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBranchDto, user?: any) {
    await this.findOne(id);
    if (user && user.role === UserRole.ADMIN && user.branchId !== id) {
      throw new ForbiddenException("Siz faqat o'z filialingizni tahrirlay olasiz");
    }
    await this.branchRepo.update(id, dto);
    return this.findOne(id);
  }

  // ────────────────────────────────────────────────────────────
  // 6. Arxivlash (Soft-delete)
  // ────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.branchRepo.softDelete(id);
  }

  // ────────────────────────────────────────────────────────────
  // 7. Admin — FAQAT lokatsiyani yangilash
  //    Admin o'z branch'idan boshqa branch'ni o'zgartira olmaydi
  //    Faqat latitude va longitude yangilanadi, boshqa hech narsa
  // ────────────────────────────────────────────────────────────
  async updateLocation(dto: UpdateBranchLocationDto, user: any) {
    // 1) Admin o'z branch'iga biriktirilganligini tekshirish
    if (!user.branchId) {
      throw new ForbiddenException(
        'Sizga hech qaysi filial biriktirilmagan. Superadminga murojaat qiling.',
      );
    }

    // 2) Branch mavjudligini tekshirish
    const branch = await this.branchRepo.findOne({
      where: { id: user.branchId },
    });
    if (!branch) {
      throw new NotFoundException('Sizga biriktirilgan filial topilmadi');
    }

    // 3) FAQAT latitude va longitude — boshqa fieldlar o'zgarmaydi
    await this.branchRepo.update(user.branchId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    this.logger.log(
      `Admin[${user.id}] filial[${user.branchId}] lokatsiyasini yangiladi: lat=${dto.latitude}, lng=${dto.longitude}`,
    );

    return this.findOne(user.branchId);
  }

  // ────────────────────────────────────────────────────────────
  // 8. O'qituvchi uchun qo'lda davomat sozlamasini o'zgartirish
  //    Admin faqat o'z filialining sozlamasini o'zgartira oladi
  // ────────────────────────────────────────────────────────────
  async toggleTeacherManualAttendance(
    dto: ToggleTeacherManualAttendanceDto,
    user: any,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Sizga hech qaysi filial biriktirilmagan. Superadminga murojaat qiling.',
      );
    }

    const branch = await this.branchRepo.findOne({
      where: { id: user.branchId },
    });
    if (!branch) {
      throw new NotFoundException('Sizga biriktirilgan filial topilmadi');
    }

    await this.branchRepo.update(user.branchId, {
      allowTeacherManualAttendance: dto.allowTeacherManualAttendance,
    });

    this.logger.log(
      `Admin[${user.id}] filial[${user.branchId}] o'qituvchi qo'lda davomat sozlamasini o'zgartirdi: ${dto.allowTeacherManualAttendance}`,
    );

    return this.findOne(user.branchId);
  }

  // ────────────────────────────────────────────────────────────
  // 9. O'qituvchi qo'lda davomat qila olish holatini olish
  // ────────────────────────────────────────────────────────────
  async getTeacherManualAttendanceStatus(user: any) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Sizga hech qaysi filial biriktirilmagan. Superadminga murojaat qiling.',
      );
    }

    const branch = await this.branchRepo.findOne({
      where: { id: user.branchId },
      select: ['id', 'allowTeacherManualAttendance'],
    });

    if (!branch) {
      throw new NotFoundException('Sizga biriktirilgan filial topilmadi');
    }

    return {
      allowTeacherManualAttendance: branch.allowTeacherManualAttendance,
    };
  }
}
