import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: salaryPayouts jadvalini salary_payouts ga rename qilish
 *
 * Bu migration mavjud DB da:
 *   - "salaryPayouts" jadvalini "salary_payouts" ga rename qiladi
 *   - "salaryPayouts_status_enum" enum turini "salary_payouts_status_enum" ga rename qiladi
 *   - "paidAt" ustunini timestamptz, nullable ga o'zgartiradi (Bug #10 fix)
 *   - Eski constraint va index nomlarini yangi standartga moslashtiradi
 */
export class RenameSalaryPayoutsTable1780900000000 implements MigrationInterface {
  name = 'RenameSalaryPayoutsTable1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Jadval oldin "salaryPayouts" nomi bilan mavjudligini tekshirish
    const oldTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'salaryPayouts'
    `);

    if (oldTableExists.length > 0) {
      // 2. Jadvalni rename qilish
      await queryRunner.query(`ALTER TABLE "salaryPayouts" RENAME TO "salary_payouts"`);

      // 3. Eski enum turini rename qilish
      const oldEnumExists = await queryRunner.query(`
        SELECT 1 FROM pg_type WHERE typname = 'salaryPayouts_status_enum'
      `);
      if (oldEnumExists.length > 0) {
        await queryRunner.query(
          `ALTER TYPE "public"."salaryPayouts_status_enum" RENAME TO "salary_payouts_status_enum"`,
        );
      }

      // 4. Eski unique index ni rename qilish (mavjud bo'lsa)
      const oldIndexExists = await queryRunner.query(`
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'salary_payouts'
          AND indexname = 'UQ_salaryPayouts_teacher_branch_range_paid'
      `);
      if (oldIndexExists.length > 0) {
        await queryRunner.query(
          `ALTER INDEX "UQ_salaryPayouts_teacher_branch_range_paid"
           RENAME TO "UQ_salary_payouts_teacher_branch_range_paid"`,
        );
      }

      // 5. FK constraint nomini yangilash (mavjud bo'lsa)
      const oldFkExists = await queryRunner.query(`
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'salary_payouts'
          AND constraint_name = 'FK_salaryPayouts_paidBy'
      `);
      if (oldFkExists.length > 0) {
        await queryRunner.query(
          `ALTER TABLE "salary_payouts"
           RENAME CONSTRAINT "FK_salaryPayouts_paidBy" TO "FK_salary_payouts_paidBy"`,
        );
      }
    }

    // 6. Bug #10 fix: paidAt kolonini @CreateDateColumn dan timestamptz nullable ga o'zgartirish
    const tableToCheck = oldTableExists.length > 0 ? 'salary_payouts' : 'salary_payouts';
    const paidAtInfo = await queryRunner.query(`
      SELECT column_default, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = '${tableToCheck}' AND column_name = 'paidAt'
    `);

    if (paidAtInfo.length > 0) {
      // DEFAULT CURRENT_TIMESTAMP ni olib tashlash
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ALTER COLUMN "paidAt" DROP DEFAULT`,
      );
      // Nullable qilish
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ALTER COLUMN "paidAt" DROP NOT NULL`,
      );
      // Turini timestamptz ga o'zgartirish (agar kerak bo'lsa)
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ALTER COLUMN "paidAt" TYPE TIMESTAMPTZ USING "paidAt"::TIMESTAMPTZ`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Jadvalni qayta eski nomiga qaytarish
    const newTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'salary_payouts'
    `);

    if (newTableExists.length > 0) {
      // paidAt ni qaytarish
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ALTER COLUMN "paidAt" SET DEFAULT CURRENT_TIMESTAMP`,
      );
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ALTER COLUMN "paidAt" SET NOT NULL`,
      );

      // FK constraint qaytarish
      const newFkExists = await queryRunner.query(`
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'salary_payouts'
          AND constraint_name = 'FK_salary_payouts_paidBy'
      `);
      if (newFkExists.length > 0) {
        await queryRunner.query(
          `ALTER TABLE "salary_payouts"
           RENAME CONSTRAINT "FK_salary_payouts_paidBy" TO "FK_salaryPayouts_paidBy"`,
        );
      }

      // Index qaytarish
      const newIndexExists = await queryRunner.query(`
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'salary_payouts'
          AND indexname = 'UQ_salary_payouts_teacher_branch_range_paid'
      `);
      if (newIndexExists.length > 0) {
        await queryRunner.query(
          `ALTER INDEX "UQ_salary_payouts_teacher_branch_range_paid"
           RENAME TO "UQ_salaryPayouts_teacher_branch_range_paid"`,
        );
      }

      // Enum qaytarish
      const newEnumExists = await queryRunner.query(`
        SELECT 1 FROM pg_type WHERE typname = 'salary_payouts_status_enum'
      `);
      if (newEnumExists.length > 0) {
        await queryRunner.query(
          `ALTER TYPE "public"."salary_payouts_status_enum" RENAME TO "salaryPayouts_status_enum"`,
        );
      }

      // Jadvalni qaytarish
      await queryRunner.query(`ALTER TABLE "salary_payouts" RENAME TO "salaryPayouts"`);
    }
  }
}
