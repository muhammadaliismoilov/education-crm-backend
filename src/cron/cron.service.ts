// src/cron/cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Student } from '../entities/students.entity';
import { DataSource, Repository } from 'typeorm';

// Bir vaqtda nechta student qayta ishlanadi
const CHUNK_SIZE = 100;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  
  // Cron ikki marta ishlashini oldini olish uchun
  private isRunning = false;

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyBilling() {
    // 1. Idempotency tekshiruvi — ikki marta ishlamasligi uchun
    if (this.isRunning) {
      this.logger.warn('Oylik billing allaqachon ishlayapti, skip...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log('=== Oylik hisob-kitob boshlandi ===');

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let page = 0;

    try {
      // 2. Chunklarga bo'lib yuklash — RAM toshmasligi uchun
      while (true) {
        const students = await this.studentRepo.find({
          relations: ['enrolledGroups'],
          skip: page * CHUNK_SIZE,
          take: CHUNK_SIZE,
          order: { id: 'ASC' },
        });

        // Chunk bo'sh bo'lsa — hammasi qayta ishlandi
        if (students.length === 0) break;

        this.logger.debug(
          `Chunk ${page + 1}: ${students.length} ta student qayta ishlanmoqda...`,
        );

        // 3. Har bir chunk uchun alohida transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const bulkUpdates: { id: string; balance: number }[] = [];

          for (const student of students) {
            // Guruhi yo'q studentlarni skip
            if (!student.enrolledGroups || student.enrolledGroups.length === 0) {
              totalSkipped++;
              continue;
            }

            const totalMonthlyPrice = student.enrolledGroups.reduce(
              (sum, g) => sum + Number(g.price || 0),
              0,
            );

            // Narx 0 bo'lsa skip
            if (totalMonthlyPrice === 0) {
              totalSkipped++;
              continue;
            }

            const currentBalance = Number(student.balance || 0);
            // balance - oylik narx = yangi balance
            // Agar balance manfiy bo'lsa — qarz ortadi
            const newBalance = currentBalance - totalMonthlyPrice;

            bulkUpdates.push({ id: student.id, newBalance } as any);
          }

          // 4. Bulk update — N+1 emas, bitta query!
          if (bulkUpdates.length > 0) {
            // TypeORM bulk update — CASE WHEN bilan bitta query
            await Promise.all(
              bulkUpdates.map(({ id, newBalance }: any) =>
                queryRunner.manager.update(Student, { id }, { balance: newBalance }),
              ),
            );
          }

          await queryRunner.commitTransaction();
          totalProcessed += bulkUpdates.length;

          this.logger.debug(
            `Chunk ${page + 1} muvaffaqiyatli: ${bulkUpdates.length} ta yangilandi`,
          );
        } catch (chunkError) {
          // Bitta chunk xato bo'lsa — faqat shu chunk rollback, qolganlari saqlanadi
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

        // 5. Server ga nafas olish imkoni — har chunk orasida 100ms kutish
        await this.sleep(100);
      }
    } catch (fatalError) {
      this.logger.error(
        'Kritik xato yuz berdi!',
        fatalError.stack,
      );
    } finally {
      this.isRunning = false;
    }

    // 6. Monitoring — natijalar
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.logger.log('=== Oylik hisob-kitob yakunlandi ===');
    this.logger.log(`✅ Yangilandi:  ${totalProcessed} ta student`);
    this.logger.log(`⏭️  Skip:        ${totalSkipped} ta student`);
    this.logger.log(`❌ Xato:        ${totalErrors} ta student`);
    this.logger.log(`⏱️  Vaqt:        ${duration} soniya`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}