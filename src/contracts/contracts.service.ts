import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ContractStatus } from '../entities/contract.entity';
import { ContractTemplate } from '../entities/contract-template.entity';
import { Student } from '../entities/students.entity';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
  ) {}

  async create(dto: CreateContractDto, user: any) {
    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId, branch: { id: user.branchId } },
    });
    if (!student) {
      throw new NotFoundException("O'quvchi topilmadi");
    }

    const maxContract = await this.contractRepo
      .createQueryBuilder('contract')
      .where('contract.branchId = :branchId', { branchId: user.branchId })
      .orderBy('contract.contractNumber', 'DESC')
      .getOne();

    const nextContractNumber = maxContract ? maxContract.contractNumber + 1 : 1;

    // Agar templateId berilgan bo'lsa, uni topib contentini to'ldiramiz
    let finalContent = dto.content;
    if (dto.templateId) {
      const template = await this.contractRepo.manager.findOne(
        ContractTemplate,
        {
          where: { id: dto.templateId, branch: { id: user.branchId } },
          relations: ['branch'],
        },
      );
      if (!template) {
        throw new NotFoundException('Shablon topilmadi');
      }

      // JSON formatida saqlangan contentni string ga o'tkazib placeholder larni almashtiramiz
      const templateContentStr = JSON.stringify(template.content);
      const replacedStr = templateContentStr
        .replace(/{{studentName}}/g, student.fullName)
        .replace(/{{parentName}}/g, student.parentName || '')
        .replace(/{{studentPhone}}/g, student.phone || '')
        .replace(/{{contractNumber}}/g, nextContractNumber.toString())
        .replace(/{{date}}/g, new Date().toLocaleDateString('uz-UZ'))
        .replace(/{{branchName}}/g, template.branch?.name || '');
        
      finalContent = JSON.parse(replacedStr);
    }

    const contract = this.contractRepo.create({
      title: dto.title,
      student: { id: student.id },
      content: finalContent,
      fileUrl: dto.fileUrl,
      branch: { id: user.branchId },
      createdBy: { id: user.id },
      status: ContractStatus.DRAFT,
      version: 1,
      contractNumber: nextContractNumber,
    });

    return this.contractRepo.save(contract);
  }

  async findAll(user: any) {
    return this.contractRepo.find({
      where: { branch: { id: user.branchId } },
      relations: ['student', 'createdBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: any) {
    const contract = await this.contractRepo.findOne({
      where: { id, branch: { id: user.branchId } },
      relations: ['student', 'createdBy', 'approvedBy'],
    });

    if (!contract) {
      throw new NotFoundException('Shartnoma topilmadi');
    }

    return contract;
  }

  async update(id: string, dto: UpdateContractDto, user: any) {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        'Faqat DRAFT holatidagi shartnomani tahrirlash mumkin',
      );
    }

    Object.assign(contract, dto);
    // Har safar tahrirlanganda version ni oshiramiz
    contract.version += 1;

    return this.contractRepo.save(contract);
  }

  async approve(id: string, user: any) {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Shartnoma DRAFT holatida emas');
    }

    contract.status = ContractStatus.APPROVED;
    contract.approvedBy = { id: user.id } as any;

    return this.contractRepo.save(contract);
  }

  async markAsSigned(id: string, user: any) {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.APPROVED) {
      throw new BadRequestException(
        'Faqat APPROVED shartnomani imzolangan deb belgilash mumkin',
      );
    }

    contract.status = ContractStatus.SIGNED;
    contract.signedAt = new Date();

    return this.contractRepo.save(contract);
  }

  async remove(id: string, user: any) {
    const contract = await this.findOne(id, user);

    if (contract.status === ContractStatus.SIGNED) {
      throw new BadRequestException(
        "Imzolangan shartnomani o'chirish mumkin emas",
      );
    }

    await this.contractRepo.softRemove(contract);
    return { message: "Shartnoma o'chirildi" };
  }

  async generatePdf(id: string, user: any): Promise<Buffer> {
    const contract = await this.findOne(id, user);

    if (!contract.content) {
      throw new BadRequestException(
        "Bu shartnoma matnga (content) ega emas. U fayl formatida bo'lishi mumkin.",
      );
    }

    let generatedHtml = '';
    if (typeof contract.content === 'object' && contract.content !== null) {
      for (const [key, value] of Object.entries(contract.content)) {
        if (key === 'title') {
          generatedHtml += `<h1>${value}</h1>`;
        } else if (/^[a-zA-Z0-9]+$/.test(key)) {
          // 'p', 'h2', 'div', 'span', va hokazo teglar orqali kelgan bo'lsa
          generatedHtml += `<${key}>${value}</${key}>`;
        } else {
          generatedHtml += `<div>${value}</div>`;
        }
      }
    } else {
      generatedHtml = String(contract.content);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${contract.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
          h1 { text-align: center; }
        </style>
      </head>
      <body>
        ${generatedHtml}
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // As of Puppeteer 20+, pdf() returns a Uint8Array. Buffer.from handles it.
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    const pdfBuffer = Buffer.from(pdfUint8Array);

    await browser.close();

    return pdfBuffer;
  }

  async generatePdfByStudent(studentId: string, user: any): Promise<Buffer> {
    const contract = await this.contractRepo.findOne({
      where: { student: { id: studentId }, branch: { id: user.branchId } },
      order: { createdAt: 'DESC' },
    });

    if (!contract) {
      throw new NotFoundException('Talabaga tegishli shartnoma topilmadi.');
    }

    return this.generatePdf(contract.id, user);
  }
}
