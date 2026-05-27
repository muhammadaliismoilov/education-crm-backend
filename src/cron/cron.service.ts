import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Student } from '../entities/students.entity';
import { Invoice } from '../entities/invoice.entity';
import { DataSource, QueryRunner, Repository } from 'typeorm';

const CHUNK_SIZE = 100;
const INSERT_CHUNK_SIZE = 100;
const MONTHLY_BILLING_LOCK_KEY = 20260501;
const BILLING_TIME_ZONE = 'Asia/Tashkent';
const TASHKENT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

type InvoiceInsertPayload = {
  amount: number;
  type: 'monthly_fee';
  billingMonth: string;
  student: { id: string };
  group: { id: string };
  branch: { id: string } | null;
};

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    timeZone: 'Asia/Tashkent',
  })
  async handleMonthlyBilling() {
    if (this.isRunning) {
      this.logger.warn('Oylik billing allaqachon ishlayapti, skip...');
      return;
    }

    this.isRunning = true;
    let lockRunner: QueryRunner | null = null;
    const startTime = Date.now();
    const { start, endExclusive, billingMonth } =
      this.getCurrentMonthBounds();
    this.logger.log('Oylik hisob-kitob boshlandi');
    this.logger.log(
      `Billing period: ${billingMonth} / ${start.toISOString()} -> ${endExclusive.toISOString()} (exclusive)`,
    );

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let page = 0;

    try {
      lockRunner = await this.acquireCronLock();
      if (!lockRunner) {
        this.logger.warn(
          "Oylik billing uchun DB lock olinmadi. Boshqa instance ishlayotgan bo'lishi mumkin, skip qilindi.",
        );
        return;
      }

      while (true) {
        const students = await this.studentRepo.find({
          relations: [
            'branch',
            'enrolledGroups',
            'enrolledGroups.branch',
            'discounts',
            'discounts.group',
          ],
          skip: page * CHUNK_SIZE,
          take: CHUNK_SIZE,
          order: { id: 'ASC' },
        });

        if (students.length === 0) break;

        this.logger.debug(
          `Chunk ${page + 1}: ${students.length} ta student qayta ishlanmoqda`,
        );

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const invoicesToInsert: InvoiceInsertPayload[] = [];
          const billedStudentIds = new Set<string>();
          const chunkStudentIds = students.map((s) => s.id);
          const existingKeys = new Set<string>();

          if (chunkStudentIds.length > 0) {
            const existingInvoices = await queryRunner.manager
              .createQueryBuilder(Invoice, 'invoice')
              .select('invoice.studentId', 'studentId')
              .addSelect('invoice.groupId', 'groupId')
              .where('invoice.type = :type', { type: 'monthly_fee' })
              .andWhere('invoice.billingMonth = :billingMonth', {
                billingMonth,
              })
              .andWhere('invoice.studentId IN (:...studentIds)', {
                studentIds: chunkStudentIds,
              })
              .getRawMany();

            for (const row of existingInvoices) {
              if (row.studentId && row.groupId) {
                existingKeys.add(this.buildInvoiceKey(row.studentId, row.groupId));
              }
            }
          }

          for (const student of students) {
            if (
              !student.enrolledGroups ||
              student.enrolledGroups.length === 0
            ) {
              totalSkipped++;
              continue;
            }

            const studentBranchId = student.branch?.id ?? null;
            let hasBillableGroup = false;

            for (const g of student.enrolledGroups) {
              if (g.isActive === false) continue; // Arxivlangan guruhlar uchun to'lov yozilmaydi

              const groupBranchId = g.branch?.id ?? null;
              if (
                studentBranchId &&
                groupBranchId &&
                studentBranchId !== groupBranchId
              ) {
                this.logger.warn(
                  `Branch mismatch skip [student: ${student.id}] [studentBranch: ${studentBranchId}] [group: ${g.id}] [groupBranch: ${groupBranchId}]`,
                );
                continue;
              }

              const discount = student.discounts?.find(
                (d) => d.group?.id === g.id,
              );
              const discountPrice = discount ? Number(discount.customPrice) : 0;
              const effectivePrice =
                discountPrice > 0 ? discountPrice : Number(g.price || 0);

              if (effectivePrice <= 0) {
                continue;
              }

              hasBillableGroup = true;

              const invoiceKey = this.buildInvoiceKey(student.id, g.id);
              if (existingKeys.has(invoiceKey)) {
                continue;
              }

              existingKeys.add(invoiceKey);
              const invoiceBranchId = studentBranchId ?? groupBranchId;
              invoicesToInsert.push({
                amount: effectivePrice,
                type: 'monthly_fee',
                billingMonth,
                student: { id: student.id },
                group: { id: g.id },
                branch: invoiceBranchId ? { id: invoiceBranchId } : null,
              });
              billedStudentIds.add(student.id);
            }

            if (!hasBillableGroup) {
              totalSkipped++;
            }
          }

          if (invoicesToInsert.length > 0) {
            // Chunks for bulk insert to avoid query limits
            for (
              let i = 0;
              i < invoicesToInsert.length;
              i += INSERT_CHUNK_SIZE
            ) {
              const chunk = invoicesToInsert.slice(i, i + INSERT_CHUNK_SIZE);
              await queryRunner.manager
                .createQueryBuilder()
                .insert()
                .into(Invoice)
                .values(chunk)
                .orIgnore()
                .execute();
            }
          }

          const billedStudents = Array.from(billedStudentIds);
          if (billedStudents.length > 0) {
            await this.recalculateBalances(queryRunner, billedStudents);
          }

          await queryRunner.commitTransaction();
          totalProcessed += billedStudents.length;

          this.logger.debug(
            `Chunk ${page + 1} muvaffaqiyatli: ${billedStudents.length} ta student balansi yangilandi`,
          );
        } catch (chunkError) {
          await queryRunner.rollbackTransaction();
          totalErrors += students.length;
          this.logger.error(
            `Chunk ${page + 1} xato: ${chunkError.message}`,
            chunkError.stack,
          );
        } finally {
          await queryRunner.release();
        }

        page++;
        await this.sleep(100);
      }
    } catch (fatalError) {
      this.logger.error('Kritik xato yuz berdi!', fatalError.stack);
    } finally {
      await this.releaseCronLock(lockRunner);
      this.isRunning = false;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.logger.log('Oylik hisob-kitob yakunlandi');
    this.logger.log(`Yangilandi: ${totalProcessed} ta student`);
    this.logger.log(`Skip: ${totalSkipped} ta student`);
    this.logger.log(`Xato: ${totalErrors} ta student`);
    this.logger.log(`Vaqt: ${duration} soniya`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCurrentMonthBounds(reference = new Date()): {
    start: Date;
    endExclusive: Date;
    billingMonth: string;
  } {
    const { year, month } = this.getBillingYearMonth(reference);
    const start = new Date(
      Date.UTC(year, month - 1, 1) - TASHKENT_UTC_OFFSET_MS,
    );
    const endExclusive = new Date(
      Date.UTC(year, month, 1) - TASHKENT_UTC_OFFSET_MS,
    );
    const billingMonth = `${year}-${String(month).padStart(2, '0')}-01`;

    return { start, endExclusive, billingMonth };
  }

  private getBillingYearMonth(reference: Date): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BILLING_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(reference);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);

    return { year, month };
  }

  private buildInvoiceKey(studentId: string, groupId: string): string {
    return `${studentId}:${groupId}`;
  }

  private async acquireCronLock(): Promise<QueryRunner | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    try {
      const result = await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [MONTHLY_BILLING_LOCK_KEY],
      );
      const locked = result?.[0]?.locked === true;

      if (!locked) {
        await runner.release();
        return null;
      }

      return runner;
    } catch (error) {
      await runner.release();
      throw error;
    }
  }

  private async releaseCronLock(runner: QueryRunner | null): Promise<void> {
    if (!runner) return;

    try {
      await runner.query('SELECT pg_advisory_unlock($1)', [
        MONTHLY_BILLING_LOCK_KEY,
      ]);
    } catch (error) {
      this.logger.error(
        "Cron DB lock ni bo'shatishda xatolik",
        (error as Error).stack,
      );
    } finally {
      await runner.release();
    }
  }

  private async recalculateBalances(
    queryRunner: QueryRunner,
    studentIds: string[],
  ): Promise<void> {
    if (studentIds.length === 0) return;

    await queryRunner.query(
      `
        WITH target_students AS (
          SELECT UNNEST($1::uuid[]) AS id
        ),
        payment_totals AS (
          SELECT p."studentId" AS id, SUM(CAST(p."amount" AS DECIMAL)) AS total_paid
          FROM "payments" p
          WHERE p."studentId" IN (SELECT id FROM target_students)
          GROUP BY p."studentId"
        ),
        invoice_totals AS (
          SELECT i."studentId" AS id, SUM(CAST(i."amount" AS DECIMAL)) AS total_invoiced
          FROM "invoices" i
          WHERE i."studentId" IN (SELECT id FROM target_students)
          GROUP BY i."studentId"
        )
        UPDATE "students" s
        SET "balance" = COALESCE(payment_totals.total_paid, 0) - COALESCE(invoice_totals.total_invoiced, 0)
        FROM target_students
        LEFT JOIN payment_totals ON payment_totals.id = target_students.id
        LEFT JOIN invoice_totals ON invoice_totals.id = target_students.id
        WHERE s.id = target_students.id
      `,
      [studentIds],
    );
  }
}
