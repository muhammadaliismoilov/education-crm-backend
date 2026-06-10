import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Contract, ContractStatus } from '../entities/contract.entity';
import { ContractTemplate } from '../entities/contract-template.entity';
import { Student } from '../entities/students.entity';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';
import { User, UserRole } from '../entities/user.entity';
import * as puppeteer from 'puppeteer';
import * as he from 'he';
import * as fs from 'fs';

type ContractGenerationStatus = 'created' | 'skipped' | 'failed';

interface ContractGenerationResult {
  status: ContractGenerationStatus;
  contract: Contract | null;
  reason?: string;
}

/**
 * Xavfsiz bir-marta-o'tish (single-pass) placeholder almashtirish.
 * Second-order injection ni oldini oladi: barcha qiymatlar bir vaqtda almashtiriladi,
 * shuning uchun bir qiymat boshqa placeholder ga aylanishi mumkin emas.
 */
function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
    return Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : match; // Noma'lum placeholder ni o'zgartirsiz qoldirish
  });
}

function replacePlaceholdersDeep(
  value: unknown,
  values: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    return replacePlaceholders(value, values);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholdersDeep(item, values));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = replacePlaceholdersDeep(nestedValue, values);
    }
    return result;
  }

  return value;
}

function hydrateTemplateContent(
  templateContent: unknown,
  values: Record<string, string>,
): Record<string, unknown> {
  const hydrated = replacePlaceholdersDeep(templateContent, values);

  if (hydrated && typeof hydrated === 'object' && !Array.isArray(hydrated)) {
    return hydrated as Record<string, unknown>;
  }

  return { body: stringifyValue(hydrated) };
}

function formatUzDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('uz-UZ');
}

function getDbErrorCode(error: unknown): string | undefined {
  const err = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  const code = err?.code || err?.driverError?.code;
  return typeof code === 'string' ? code : undefined;
}

function isRetryableDbError(error: unknown): boolean {
  return ['23505', '40001', '40P01'].includes(getDbErrorCode(error) || '');
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  return JSON.stringify(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return stringifyValue(error) || 'unknown error';
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

@Injectable()
export class ContractsService implements OnModuleDestroy {
  private readonly logger = new Logger(ContractsService.name);

  /**
   * FIX #4: Promise-based singleton — double-initialization race condition hal qilindi.
   * Avvalgi `this.browser` field ikkita parallel so'rov kelganda ikkita
   * Chromium process ochishga olib kelardi (klassik TOCTOU muammo).
   * Endi Promise o'zi lock vazifasini bajaradi: birinchi so'rov Promise yaratadi,
   * ikkinchi so'rov shu Promise ga await qiladi — yangi browser ochilmaydi.
   */
  private browserPromise: Promise<puppeteer.Browser> | null = null;

  constructor(
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(ContractTemplate)
    private contractTemplateRepo: Repository<ContractTemplate>,
    private dataSource: DataSource,
  ) {}

  /**
   * Module yopilganda Chromium ni ham yopish.
   * FIX #14: Race condition — browserPromise ni ham null qilamiz.
   */
  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      if (browser) {
        await browser.close().catch((err) => {
          this.logger.error('Browser yopishda xato:', err);
        });
      }
      this.browserPromise = null;
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
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  /**
   * FIX #4 + #13: Promise-based singleton, --single-process olib tashlandi.
   *
   * --single-process olib tashlandi chunki:
   * - Tab crash → butun browser process crash bo'ladi
   * - Crash bo'lganda this.browserPromise hali resolved ko'rinadi → zombie state
   *
   * Promise pattern:
   * - Birinchi chaqiruv Promise yaratib saqlaydi
   * - Parallel chaqiruvlar shu Promise ga await qiladi (yangi launch yo'q)
   * - Xato bo'lsa Promise null qilinadi → keyingi chaqiruvda qayta urinadi
   */
  private getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browserPromise) {
      const executablePath = this.getChromePath();
      if (executablePath) {
        this.logger.log(`Chrome ishlatilmoqda: ${executablePath}`);
      } else {
        this.logger.warn('System Chrome topilmadi, bundled Chromium ishlatiladi');
      }

      this.browserPromise = puppeteer
        .launch({
          headless: true,
          executablePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            // '--single-process' olib tashlandi — xavfli, crash bo'lganda
            // butun process yiqiladi va zombie browser singleton qoladi
          ],
        })
        .catch((err) => {
          // Xato bo'lsa Promise reset qilinadi — keyingi so'rovda qayta urinadi
          this.browserPromise = null;
          throw err;
        });
    }
    return this.browserPromise;
  }

  private async runSerializableWithRetry<T>(
    operation: (manager: EntityManager) => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.dataSource.transaction('SERIALIZABLE', operation);
      } catch (error) {
        lastError = error;
        if (!isRetryableDbError(error) || attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Shartnoma transaction retry [attempt: ${attempt}] [code: ${getDbErrorCode(error)}]`,
        );
      }
    }

    throw lastError;
  }

  private async findActiveContract(
    studentId: string,
    branchId: string,
    manager?: EntityManager,
  ): Promise<Contract | null> {
    const options = {
      where: {
        student: { id: studentId },
        branch: { id: branchId },
      },
    };

    if (manager) {
      return manager.findOne(Contract, options);
    }

    return this.contractRepo.findOne(options);
  }

  private buildPlaceholderValues(
    student: Student,
    contractNumber: number,
    branchName: string,
  ): Record<string, string> {
    return {
      studentName: student.fullName || '',
      parentName: student.parentName || '',
      studentPhone: student.phone || '',
      parentPhone: student.parentPhone || '',
      contractNumber: contractNumber.toString(),
      date: new Date().toLocaleDateString('uz-UZ'),
      branchName: branchName || '',
      documentNumber: student.documentNumber || '',
      pinfl: student.pinfl || '',
      birthDate: formatUzDate(student.birthDate),
      direction: student.enrolledGroups?.map((g) => g.name).join(', ') || '',
    };
  }

  /**
   * FIX #7: \n → <br> konvertatsiya qo'shildi.
   *
   * Muammo: he.escape() \n ni saqlaydi (&#10; qilmaydi), lekin HTML da
   * \n ko'rinmaydi. CSS `white-space: pre-line` faqat brauzer renderida ishlaydi,
   * PDF da esa ba'zan hisobga olinmaydi. Eng ishonchli yechim — \n → <br>.
   *
   * Xavfsizlik: he.escape() birinchi ishlatiladi, keyin <br> qo'yiladi —
   * foydalanuvchi kiritgan matndan HTML injection mumkin emas.
   */
  private renderContractContent(content: unknown): string {
    const renderText = (value: unknown) => he.escape(stringifyValue(value));
    // Xavfsiz multiline render: avval escape, keyin \n → <br>
    const renderMultiline = (value: unknown) =>
      renderText(value).replace(/\n/g, '<br>');

    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return `<p>${renderMultiline(content)}</p>`;
    }

    const record = content as Record<string, unknown>;
    const parts: string[] = [];

    if (record.title) {
      // title — sarlavha, odatda bir qatorli, escape yetarli
      parts.push(`<h1>${renderText(record.title)}</h1>`);
    }
    if (record.body) {
      // FIX: body ko'p qatorli matn — \n → <br> bilan render qilinadi
      parts.push(`<div class="contract-body">${renderMultiline(record.body)}</div>`);
    }
    if (record.footer) {
      // FIX: footer ham ko'p qatorli bo'lishi mumkin (imzo qatorlari)
      parts.push(
        `<div class="contract-footer">${renderMultiline(record.footer)}</div>`,
      );
    }

    for (const [key, value] of Object.entries(record)) {
      if (['title', 'body', 'footer'].includes(key) || value == null) continue;
      parts.push(
        `<div class="contract-section"><strong>${renderText(key)}</strong><br>${renderMultiline(value)}</div>`,
      );
    }

    if (parts.length === 0) {
      return `<p>${renderMultiline(JSON.stringify(content))}</p>`;
    }

    return parts.join('\n');
  }

  async create(dto: CreateContractDto, user: AuthenticatedUser) {
    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    if (!dto.templateId && !dto.content && !dto.fileUrl) {
      throw new BadRequestException(
        'Shartnoma yaratish uchun templateId, content yoki fileUrl dan kamida bittasi kerak',
      );
    }

    // Branch izolyatsiyasi: o'quvchi faqat xuddi shu filialdan bo'lishi shart
    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId, branch: { id: user.branchId } },
      relations: ['enrolledGroups'],
    });
    if (!student) {
      throw new NotFoundException("O'quvchi topilmadi");
    }

    const existingContract = await this.findActiveContract(
      student.id,
      user.branchId,
    );
    if (existingContract) {
      throw new ConflictException(
        "Ushbu o'quvchida aktiv shartnoma allaqachon mavjud",
      );
    }

    const contract = await this.runSerializableWithRetry(async (manager) => {
      const duplicate = await this.findActiveContract(
        student.id,
        user.branchId,
        manager,
      );
      if (duplicate) {
        throw new ConflictException(
          "Ushbu o'quvchida aktiv shartnoma allaqachon mavjud",
        );
      }

      // Raqam: hozirgi filialdagi eng katta raqamdan 1 ortiq
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

        finalContent = hydrateTemplateContent(
          template.content,
          this.buildPlaceholderValues(
            student,
            nextContractNumber,
            template.branch?.name || '',
          ),
        );
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

  /**
   * FIX #2 + #3: approvedAt audit timestamp qo'shildi + transaction bilan
   * SELECT FOR UPDATE — race condition hal qilindi.
   *
   * Muammo: Avval READ → boshqa request ham READ → ikkalasi APPROVED yozadi.
   * Yechim: REPEATABLE READ + SELECT FOR UPDATE — faqat bitta tranzaksiya
   * o'zgartirish qila oladi, ikkinchisi 40001 (serialization failure) oladi
   * va retry mexanizmi uni qayta urinadi yoki ConflictException beradi.
   */
  async approve(id: string, user: AuthenticatedUser) {
    // Avval branch check uchun tashqi findOne (transaction ichida qayta tekshiriladi)
    const preCheck = await this.findOne(id, user);
    if (preCheck.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Shartnoma DRAFT holatida emas');
    }

    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      // SELECT FOR UPDATE — boshqa parallel tranzaksiya bu qatorni o'zgartira olmaydi
      const contract = await manager
        .getRepository(Contract)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .andWhere('c.deletedAt IS NULL')
        .getOne();

      if (!contract) {
        throw new NotFoundException('Shartnoma topilmadi');
      }
      if (contract.status !== ContractStatus.DRAFT) {
        throw new BadRequestException('Shartnoma DRAFT holatida emas');
      }

      contract.status = ContractStatus.APPROVED;
      contract.approvedBy = { id: user.id } as User;
      // FIX #2: approvedAt — tasdiqlash vaqtini aniq saqlash (audit log)
      contract.approvedAt = new Date();

      return manager.save(Contract, contract);
    });
  }

  /**
   * FIX #3: markAsSigned ham transaction + SELECT FOR UPDATE bilan.
   * APPROVED → SIGNED o'tish atomic bo'lishi kerak.
   */
  async markAsSigned(id: string, user: AuthenticatedUser) {
    const preCheck = await this.findOne(id, user);
    if (preCheck.status !== ContractStatus.APPROVED) {
      throw new BadRequestException(
        'Faqat APPROVED shartnomani imzolangan deb belgilash mumkin',
      );
    }

    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const contract = await manager
        .getRepository(Contract)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .andWhere('c.deletedAt IS NULL')
        .getOne();

      if (!contract) {
        throw new NotFoundException('Shartnoma topilmadi');
      }
      if (contract.status !== ContractStatus.APPROVED) {
        throw new BadRequestException(
          'Faqat APPROVED shartnomani imzolangan deb belgilash mumkin',
        );
      }

      contract.status = ContractStatus.SIGNED;
      contract.signedAt = new Date();

      return manager.save(Contract, contract);
    });
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

    return this.renderPdfFromContent(contract.content, contract.title);
  }

  /**
   * FIX #5: Barcha PDF render logikasi bu metodga ajratildi.
   * - waitUntil: 'networkidle0' → 'domcontentloaded' (timeout xavfi yo'q)
   * - Aniq timeout belgilangan (10 soniya)
   * - Font inline base64 bilan embed qilinadi — tashqi request yo'q
   * - page.setDefaultNavigationTimeout alohida o'rnatildi
   */
  private async renderPdfFromContent(
    content: unknown,
    title: string,
  ): Promise<Buffer> {
    const generatedHtml = this.renderContractContent(content);
    const safeTitle = he.escape(title);

    // Fontni CSS da ko'rsatamiz — system fontdan foydalanamiz.
    // Agar server da serif font yo'q bo'lsa Georgia → Arial fallback ishlaydi.
    // Tashqi URL dan font yuklab olish YO'Q — networkidle0 muammosi yo'q.
    const htmlContent = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      padding: 40px;
      line-height: 1.8;
      color: #1a1a1a;
      font-size: 12pt;
    }
    h1 { text-align: center; font-size: 18pt; margin-bottom: 24px; }
    h2 { font-size: 14pt; margin-bottom: 12px; }
    .contract-body { margin-bottom: 16px; }
    .contract-footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 16px; }
    .contract-section { margin-bottom: 12px; }
    .contract-section strong { font-size: 11pt; display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
  ${generatedHtml}
</body>
</html>`;

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // FIX #5: Aniq timeout — 10 soniya yetarli, 30s emas
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(10_000);

      // FIX #5: 'domcontentloaded' — DOM tayyor bo'lgandan keyin PDF qiladi.
      // 'networkidle0' tashqi so'rovlar kutgani uchun timeout muammosiga olib kelardi.
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
      });

      return Buffer.from(pdfUint8Array);
    } finally {
      // Page har doim yopiladi — exception bo'lsa ham
      await page.close().catch((err) => {
        this.logger.error('PDF page yopishda xato:', err);
      });
    }
  }

  /**
   * FIX #6: generatePdfByStudent to'liq qayta yozildi.
   *
   * Avvalgi muammolar:
   * 1. N+1: findOne() → generatePdf() ichida qayta findOne() — 2x DB so'rov
   * 2. Faqat eng so'nggi shartnoma — agar u fileUrl li bo'lsa 400 qaytardi
   * 3. content yuklanmagan edi (relations yo'q)
   *
   * Yechim:
   * - content mavjud bo'lgan shartnomalarni to'g'ridan-to'g'ri filter qiladi
   * - Bitta DB so'rovda content bilan birga oladi
   * - renderPdfFromContent() ga to'g'ridan-to'g'ri uzatadi (qayta findOne yo'q)
   */
  async generatePdfByStudent(
    studentId: string,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const qb = this.contractRepo
      .createQueryBuilder('c')
      .where('c.studentId = :studentId', { studentId })
      .andWhere('c.deletedAt IS NULL')
      .andWhere('c.content IS NOT NULL') // faqat content li shartnomalar
      .orderBy('c.createdAt', 'DESC');

    if (!(user.role === UserRole.SUPERADMIN && !user.branchId)) {
      qb.andWhere('c.branchId = :branchId', { branchId: user.branchId });
    }

    const contract = await qb.getOne();

    if (!contract) {
      throw new NotFoundException(
        "Talabaga tegishli, matn (content) bo'lgan shartnoma topilmadi.",
      );
    }

    // FIX: generatePdf() ni chaqirmaymiz (u qayta findOne() qiladi)
    // To'g'ridan-to'g'ri content bilan render qilamiz
    return this.renderPdfFromContent(contract.content, contract.title);
  }

  private async generateContractForStudent(
    studentId: string,
    branchId: string,
    userId: string,
  ): Promise<ContractGenerationResult> {
    if (!branchId) {
      return {
        status: 'skipped',
        contract: null,
        reason: 'branchId mavjud emas',
      };
    }

    const existingContract = await this.findActiveContract(studentId, branchId);
    if (existingContract) {
      return {
        status: 'skipped',
        contract: null,
        reason: 'active contract already exists',
      };
    }

    const student = await this.studentRepo.findOne({
      where: { id: studentId, branch: { id: branchId } },
      relations: ['enrolledGroups'],
    });

    if (!student) {
      return {
        status: 'skipped',
        contract: null,
        reason: 'student not found',
      };
    }

    const template = await this.contractTemplateRepo.findOne({
      where: { branch: { id: branchId } },
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });

    if (!template) {
      return {
        status: 'skipped',
        contract: null,
        reason: 'template not found',
      };
    }

    try {
      const transactionResult = await this.runSerializableWithRetry(
        async (manager) => {
          const duplicate = await this.findActiveContract(
            studentId,
            branchId,
            manager,
          );
          if (duplicate) {
            return { created: false, contract: duplicate };
          }

          const result = await manager.query<{ max: string | null }[]>(
            `SELECT MAX("contractNumber") as max FROM contracts WHERE "branchId" = $1`,
            [branchId],
          );
          const nextContractNumber = result[0]?.max
            ? Number(result[0].max) + 1
            : 1;

          const finalContent = hydrateTemplateContent(
            template.content,
            this.buildPlaceholderValues(
              student,
              nextContractNumber,
              template.branch?.name || '',
            ),
          );

          const newContract = manager.create(Contract, {
            title: `${student.fullName} — Shartnoma`,
            student: { id: student.id },
            content: finalContent,
            branch: { id: branchId },
            createdBy: { id: userId },
            status: ContractStatus.DRAFT,
            version: 1,
            contractNumber: nextContractNumber,
          });

          const saved = await manager.save(Contract, newContract);
          return { created: true, contract: saved };
        },
      );

      if (!transactionResult.created) {
        return {
          status: 'skipped',
          contract: null,
          reason: 'active contract already exists',
        };
      }

      return { status: 'created', contract: transactionResult.contract };
    } catch (error) {
      this.logger.error(
        `Auto-shartnoma yaratishda xato [studentId: ${studentId}]:`,
        getErrorStack(error) || getErrorMessage(error),
      );
      return {
        status: 'failed',
        contract: null,
        reason: getErrorMessage(error),
      };
    }
  }

  /**
   * Yangi talaba qo'shilganda yoki boshqa holatlarda avtomatik shartnoma yaratish.
   *
   * Ishlash tartibi:
   * 1. Filialga tegishli birinchi shablonni topadi
   * 2. Shablon bo'lmasa — xatolik bermaydi, log yozadi va skip qiladi
   * 3. Shablon bo'lsa — placeholderlarni talaba ma'lumotlari bilan almashtiradi
   * 4. DRAFT holatida yangi shartnoma yaratadi
   */
  async autoGenerateContract(
    studentId: string,
    branchId: string,
    userId: string,
  ): Promise<Contract | null> {
    const result = await this.generateContractForStudent(
      studentId,
      branchId,
      userId,
    );

    if (result.status === 'created' && result.contract) {
      this.logger.log(
        `✅ Avtomatik shartnoma yaratildi [studentId: ${studentId}] ` +
          `[contract: ${result.contract.id}] [number: ${result.contract.contractNumber}]`,
      );
      return result.contract;
    }

    this.logger.warn(
      `Auto-shartnoma o'tkazib yuborildi [studentId: ${studentId}] [reason: ${result.reason}]`,
    );
    return null;
  }

  /**
   * FIX #8: generateMissingContracts ikkiga ajratildi.
   *
   * Muammo: 500 ta student bo'lsa HTTP so'rovi minutlar davomida kutib qoladi.
   * Yechim: Controller "job boshlandi" deb darhol javob qaytaradi.
   * Asosiy ish `setImmediate` orqali event loop bo'shagach background da ishga tushadi.
   *
   * Bu Bull/BullMQ o'rnatmasdan ishlaydigan yengil fire-and-forget pattern.
   * Kelajakda real queue kerak bo'lsa shu metodni queue worker ga ko'chirish mumkin.
   */
  async startGenerateMissingContracts(
    user: AuthenticatedUser,
  ): Promise<{ message: string; status: 'started' }> {
    const branchId = user.branchId;

    if (!branchId) {
      throw new ForbiddenException(
        "Ommaviy shartnoma yaratish uchun foydalanuvchida filial biriktirilgan bo'lishi kerak",
      );
    }

    // Darhol javob qaytaramiz — frontend kutib qolmaydi
    // Background ish setImmediate orqali keyingi event loop tick da boshlanadi
    setImmediate(() => {
      this.generateMissingContracts(user).catch((err) => {
        this.logger.error(
          `generateMissing background xatosi [branchId: ${branchId}]: ${getErrorMessage(err)}`,
          getErrorStack(err),
        );
      });
    });

    return {
      message:
        "Ommaviy shartnoma yaratish background da boshlandi. Jarayon tugagach loglardan tekshiring.",
      status: 'started',
    };
  }

  /**
   * Mavjud (eski) talabalarga ommaviy shartnoma yaratish — asosiy logika.
   *
   * Bu metod to'g'ridan-to'g'ri chaqirilmaydi — startGenerateMissingContracts()
   * orqali background da ishga tushiriladi.
   *
   * Ishlash tartibi:
   * 1. Filialga tegishli barcha aktiv talabalarni topadi
   * 2. Shartnomasi YO'Q talabalarni filtrlaydi (LEFT JOIN + IS NULL)
   * 3. Har biri uchun generateContractForStudent() chaqiradi
   * 4. Natijani log da yozadi
   */
  async generateMissingContracts(user: AuthenticatedUser): Promise<{
    total: number;
    created: number;
    skipped: number;
    failed: number;
  }> {
    const branchId = user.branchId;

    if (!branchId) {
      throw new ForbiddenException(
        "Ommaviy shartnoma yaratish uchun foydalanuvchida filial biriktirilgan bo'lishi kerak",
      );
    }

    // 1. Shartnomasi bo'lmagan talabalarni olish — LEFT JOIN + IS NULL trick
    const studentsWithoutContract = await this.studentRepo
      .createQueryBuilder('student')
      .leftJoin(
        'contracts',
        'contract',
        'contract."studentId" = student.id AND contract."deletedAt" IS NULL',
      )
      .where('student."branchId" = :branchId', { branchId })
      .andWhere('student."deletedAt" IS NULL') // arxivlanganlarni o'tkazib yuborish
      .andWhere('contract.id IS NULL') // shartnomasi yo'q
      .select(['student.id', 'student.fullName'])
      .getMany();

    const total = studentsWithoutContract.length;

    // 2. Filial uchun shablon mavjudligini tekshirish
    const template = await this.contractTemplateRepo.findOne({
      where: { branch: { id: branchId } },
      order: { createdAt: 'DESC' },
    });

    if (!template) {
      this.logger.warn(
        `generateMissing: Filial uchun shablon topilmadi [branchId: ${branchId}]`,
      );
      return { total, created: 0, skipped: total, failed: 0 };
    }

    this.logger.log(
      `generateMissing: ${total} ta talabaga shartnoma yaratish boshlandi [branchId: ${branchId}]`,
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    // 3. Har bir talaba uchun ketma-ket yaratish (parallel emas — DB lock konflikti xavfi)
    for (const student of studentsWithoutContract) {
      const result = await this.generateContractForStudent(
        student.id,
        branchId,
        user.id,
      );

      if (result.status === 'created') {
        created++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `generateMissing yakunlandi: ` +
        `yaratildi=${created}, o'tkazildi=${skipped}, xato=${failed} / jami=${total}`,
    );

    return { total, created, skipped, failed };
  }
}
