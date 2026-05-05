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

@Injectable()
export class ContractTemplatesService {
  constructor(
    @InjectRepository(ContractTemplate)
    private contractTemplateRepo: Repository<ContractTemplate>,
  ) {}

  async create(dto: CreateContractTemplateDto, user: any) {
    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    const template = this.contractTemplateRepo.create({
      ...dto,
      branch: { id: user.branchId },
    });

    return this.contractTemplateRepo.save(template);
  }

  async findAll(user: any) {
    return this.contractTemplateRepo.find({
      where: { branch: { id: user.branchId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: any) {
    const template = await this.contractTemplateRepo.findOne({
      where: { id, branch: { id: user.branchId } },
    });

    if (!template) {
      throw new NotFoundException('Shablon topilmadi');
    }

    return template;
  }

  async update(id: string, dto: UpdateContractTemplateDto, user: any) {
    const template = await this.findOne(id, user);

    Object.assign(template, dto);
    return this.contractTemplateRepo.save(template);
  }

  async remove(id: string, user: any) {
    const template = await this.findOne(id, user);
    await this.contractTemplateRepo.softRemove(template);
    return { message: "Shablon o'chirildi" };
  }
}
