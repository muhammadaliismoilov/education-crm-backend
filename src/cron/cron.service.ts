import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Student } from '../entities/students.entity';
import { DataSource, Repository } from 'typeorm';

const CHUNK_SIZE = 100;

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

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyBilling() {
    if (this.isRunning) {
      this.logger.warn('Oylik billing allaqachon ishlayapti, skip...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log('Oylik hisob-kitob boshlandi');

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let page = 0;

    try {
      while (true) {
        const students = await this.studentRepo.find({
          relations: ['enrolledGroups', 'discounts', 'discounts.group'],
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
          const bulkUpdates: { id: string; newBalance: number }[] = [];

          for (const student of students) {
            if (!student.enrolledGroups || student.enrolledGroups.length === 0) {
              totalSkipped++;
              continue;
            }

            const totalMonthlyPrice = student.enrolledGroups.reduce(
              (sum, g) => {
                const discount = student.discounts?.find(
                  (d) => d.group?.id === g.id,
                );
                return (
                  sum +
                  (discount
                    ? Number(discount.customPrice)
                    : Number(g.price || 0))
                );
              },
              0,
            );

            if (totalMonthlyPrice === 0) {
              totalSkipped++;
              continue;
            }

            const currentBalance = Number(student.balance || 0);
            const newBalance = currentBalance - totalMonthlyPrice;
            bulkUpdates.push({ id: student.id, newBalance });
          }

          if (bulkUpdates.length > 0) {
            await queryRunner.manager
              .createQueryBuilder()
              .update(Student)
              .set({
                balance: () =>
                  `CASE "id" ${bulkUpdates
                    .map(({ id, newBalance }) => `WHEN '${id}' THEN ${newBalance}`)
                    .join(' ')} ELSE "balance" END`,
              })
              .where('id IN (:...ids)', {
                ids: bulkUpdates.map((u) => u.id),
              })
              .execute();
          }

          await queryRunner.commitTransaction();
          totalProcessed += bulkUpdates.length;

          this.logger.debug(
            `Chunk ${page + 1} muvaffaqiyatli: ${bulkUpdates.length} ta yangilandi`,
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
}