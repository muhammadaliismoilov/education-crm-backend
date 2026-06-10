import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractTemplate } from '../entities/contract-template.entity';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
} from './dto/contract-template.dto';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class ContractTemplatesService {
  constructor(
    @InjectRepository(ContractTemplate)
    private contractTemplateRepo: Repository<ContractTemplate>,
  ) {}

  async create(dto: CreateContractTemplateDto, user: AuthenticatedUser) {
    // SUPERADMIN ham branchId talab qiladi — agar kelajakda global shablon kerak bo'lsa
    // bu logikani kengaytirish mumkin
    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    const template = this.contractTemplateRepo.create({
      ...dto,
      branch: { id: user.branchId },
    });

    return this.contractTemplateRepo.save(template);
  }

  async findAll(user: AuthenticatedUser) {
    // SUPERADMIN barcha filiallarni ko'rishi mumkin (ixtiyoriy kengaytirish)
    const where =
      user.role === UserRole.SUPERADMIN && !user.branchId
        ? {}
        : { branch: { id: user.branchId } };

    return this.contractTemplateRepo.find({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const where =
      user.role === UserRole.SUPERADMIN && !user.branchId
        ? { id }
        : { id, branch: { id: user.branchId } };

    const template = await this.contractTemplateRepo.findOne({
      where,
      relations: ['branch'],
    });

    if (!template) {
      throw new NotFoundException('Shablon topilmadi');
    }

    return template;
  }

  async update(id: string, dto: UpdateContractTemplateDto, user: AuthenticatedUser) {
    const template = await this.findOne(id, user);

    Object.assign(template, dto);
    return this.contractTemplateRepo.save(template);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const template = await this.findOne(id, user);
    await this.contractTemplateRepo.softRemove(template);
    return { message: "Shablon o'chirildi" };
  }
}
