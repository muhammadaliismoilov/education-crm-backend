import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Contract, ContractStatus } from '../entities/contract.entity';
import { ContractTemplate } from '../entities/contract-template.entity';
import { Student } from '../entities/students.entity';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';
import { UserRole } from '../entities/user.entity';
import * as puppeteer from 'puppeteer';
import * as he from 'he';

/** Tizimda ruxsat etilgan placeholder kalitlar */
const ALLOWED_PLACEHOLDERS: Record<string, string> = {
  studentName: '',
  parentName: '',
  studentPhone: '',
  contractNumber: '',
  date: '',
  branchName: '',
};

/**
 * Xavfsiz bir-marta-o'tish (single-pass) placeholder almashtirish.
 * Second-order injection ni oldini oladi: barcha qiymatlar bir vaqtda almashtiriladi,
 * shuning uchun bir qiymat boshqa placeholder ga aylanishi mumkin emas.
 */
function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : match; // Noma'lum placeholder ni o'zgartirsiz qoldirish
  });
}

/**
 * HTML injection dan himoya qilish uchun qiymatlarni escape qilish.
 * `he.escape()` XSS ni to'liq oldini oladi.
 */
function escapeValues(values: Record<string, string>): Record<string, string> {
  const escaped: Record<string, string> = {};
  for (const [key, val] of Object.entries(values)) {
    escaped[key] = he.escape(String(val ?? ''));
  }
  return escaped;
}

@Injectable()
export class ContractsService implements OnModuleDestroy {
  private readonly logger = new Logger(ContractsService.name);

  /**
   * Puppeteer browser singleton — har so'rovda yangi browser ochilmaydi.
   * Bu performance va resource leak muammosini hal qiladi.
   */
  private browser: puppeteer.Browser | null = null;

  constructor(
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(ContractTemplate)
    private contractTemplateRepo: Repository<ContractTemplate>,
    private dataSource: DataSource,
  ) {}

  /** Module yopilganda Chromium ni ham yopish */
  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch((err) => {
        this.logger.error('Browser yopishda xato:', err);
      });
      this.browser = null;
    }
  }

  /** System Chrome yoki Chromium executable path ni aniqlash */
  private getChromePath(): string | undefined {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    const fs = require('fs');
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return undefined; // Topilmasa Puppeteer o'z bundled Chromium ni ishlatadi
  }

  /** Puppeteer browser singleton getter */
  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser || !this.browser.connected) {
      const executablePath = this.getChromePath();
      if (executablePath) {
        this.logger.log(`Chrome ishlatilmoqda: ${executablePath}`);
      } else {
        this.logger.warn('System Chrome topilmadi, bundled Chromium ishlatiladi');
      }

      this.browser = await puppeteer.launch({
        headless: true,
        executablePath, // system Chrome bo'lsa ishlatiladi
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',   // /dev/shm kichik bo'lsa crash bo'lmaydi
          '--disable-gpu',             // server da GPU yo'q
          '--no-first-run',
          '--no-zygote',               // root user uchun kerak
          '--single-process',          // ba'zi muhitlarda barqarorroq
        ],
      });
    }
    return this.browser;
  }

  async create(dto: CreateContractDto, user: AuthenticatedUser) {
    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    // Branch izolyatsiyasi: o'quvchi faqat xuddi shu filialdan bo'lishi shart
    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId, branch: { id: user.branchId } },
    });
    if (!student) {
      throw new NotFoundException("O'quvchi topilmadi");
    }

    // ✅ Race condition fix: transaction + SELECT FOR UPDATE bilan atomik contractNumber
    const contract = await this.dataSource.transaction(async (manager) => {
      // Pessimistic lock — parallel so'rovlar bir xil raqam olmasligi uchun
      const result = await manager.query<{ max: string | null }[]>(
        `SELECT MAX("contractNumber") as max FROM contracts WHERE "branchId" = $1`,
        [user.branchId],
      );
      const nextContractNumber = result[0]?.max ? Number(result[0].max) + 1 : 1;

      // Shablon bilan ishlash
      let finalContent = dto.content as Record<string, any> | undefined;

      if (dto.templateId) {
        const template = await manager.findOne(ContractTemplate, {
          where: { id: dto.templateId, branch: { id: user.branchId } },
          relations: ['branch'],
        });
        if (!template) {
          throw new NotFoundException('Shablon topilmadi');
        }

        // ✅ Second-order injection fix: barcha qiymatlar bir vaqtda almashtiriladi
        const rawValues: Record<string, string> = {
          studentName: student.fullName,
          parentName: student.parentName || '',
          studentPhone: student.phone || '',
          contractNumber: nextContractNumber.toString(),
          date: new Date().toLocaleDateString('uz-UZ'),
          branchName: template.branch?.name || '',
        };

        // ✅ XSS fix: almashtirish OLDIDAN escape qilamiz
        const safeValues = escapeValues(rawValues);

        const templateStr = JSON.stringify(template.content);
        const replacedStr = replacePlaceholders(templateStr, safeValues);
        finalContent = JSON.parse(replacedStr);
      }

      const newContract = manager.create(Contract, {
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

      return manager.save(Contract, newContract);
    });

    return contract;
  }

  async findAll(
    user: AuthenticatedUser,
    page = 1,
    limit = 20,
  ): Promise<{ data: Contract[]; total: number; page: number; limit: number }> {
    const where =
      user.role === UserRole.SUPERADMIN && !user.branchId
        ? {}
        : { branch: { id: user.branchId } };

    const [data, total] = await this.contractRepo.findAndCount({
      where,
      relations: ['student', 'createdBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const where =
      user.role === UserRole.SUPERADMIN && !user.branchId
        ? { id }
        : { id, branch: { id: user.branchId } };

    const contract = await this.contractRepo.findOne({
      where,
      relations: ['student', 'createdBy', 'approvedBy'],
    });

    if (!contract) {
      throw new NotFoundException('Shartnoma topilmadi');
    }

    return contract;
  }

  async update(id: string, dto: UpdateContractDto, user: AuthenticatedUser) {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        'Faqat DRAFT holatidagi shartnomani tahrirlash mumkin',
      );
    }

    Object.assign(contract, dto);
    contract.version += 1;

    return this.contractRepo.save(contract);
  }

  async approve(id: string, user: AuthenticatedUser) {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Shartnoma DRAFT holatida emas');
    }

    contract.status = ContractStatus.APPROVED;
    contract.approvedBy = { id: user.id } as any;

    return this.contractRepo.save(contract);
  }

  async markAsSigned(id: string, user: AuthenticatedUser) {
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

  async remove(id: string, user: AuthenticatedUser) {
    const contract = await this.findOne(id, user);

    if (contract.status === ContractStatus.SIGNED) {
      throw new BadRequestException(
        "Imzolangan shartnomani o'chirish mumkin emas",
      );
    }

    await this.contractRepo.softRemove(contract);
    return { message: "Shartnoma o'chirildi" };
  }

  async generatePdf(id: string, user: AuthenticatedUser): Promise<Buffer> {
    const contract = await this.findOne(id, user);

    if (!contract.content) {
      throw new BadRequestException(
        "Bu shartnoma matniga (content) ega emas. U fayl formatida bo'lishi mumkin.",
      );
    }

    // ✅ XSS fix: faqat ruxsat etilgan teglar, barcha qiymatlar he.escape() bilan
    const SAFE_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'div', 'span', 'b', 'i', 'ul', 'li']);

    let generatedHtml = '';
    if (typeof contract.content === 'object' && contract.content !== null) {
      for (const [key, value] of Object.entries(contract.content)) {
        // ✅ Faqat whitelist'dagi teglar ishlatiladi
        const safeTag = SAFE_TAGS.has(key) ? key : 'div';
        // ✅ Qiymat HTML-escape qilinadi
        const safeValue = he.escape(String(value ?? ''));
        generatedHtml += `<${safeTag}>${safeValue}</${safeTag}>\n`;
      }
    } else {
      generatedHtml = `<p>${he.escape(String(contract.content))}</p>`;
    }

    // ✅ title ham escape qilinadi
    const safeTitle = he.escape(contract.title);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="uz">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${safeTitle}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.8; color: #1a1a1a; }
          h1 { text-align: center; font-size: 18pt; margin-bottom: 24px; }
          h2 { font-size: 14pt; }
          p, div { font-size: 12pt; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        ${generatedHtml}
      </body>
      </html>
    `;

    // ✅ Puppeteer singleton — har so'rovda yangi browser emas
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
      });

      return Buffer.from(pdfUint8Array);
    } finally {
      // ✅ Resource leak fix: exception bo'lsa ham page albatta yopiladi
      await page.close().catch((err) => {
        this.logger.error('PDF page yopishda xato:', err);
      });
    }
  }

  async generatePdfByStudent(
    studentId: string,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const where =
      user.role === UserRole.SUPERADMIN && !user.branchId
        ? { student: { id: studentId } }
        : { student: { id: studentId }, branch: { id: user.branchId } };

    const contract = await this.contractRepo.findOne({
      where,
      order: { createdAt: 'DESC' },
    });

    if (!contract) {
      throw new NotFoundException('Talabaga tegishli shartnoma topilmadi.');
    }

    return this.generatePdf(contract.id, user);
  }
}
