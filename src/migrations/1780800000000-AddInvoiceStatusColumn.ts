import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invoice jadvaliga status ustuni qo'shadi.
 * Barcha mavjud yozuvlar 'ACTIVE' holatiga o'tkaziladi.
 * Unique index faqat ACTIVE invoicelarga qo'llaniladi.
 */
export class AddInvoiceStatusColumn1780800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enum type yaratish
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoices_status_enum') THEN
          CREATE TYPE "invoices_status_enum" AS ENUM ('ACTIVE', 'CANCELLED');
        END IF;
      END $$;
    `);

    // 2. Status ustunini qo'shish (default ACTIVE — barcha mavjud yozuvlar ACTIVE bo'ladi)
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "status" "invoices_status_enum" NOT NULL DEFAULT 'ACTIVE'
    `);

    // 3. Eski unique indexni o'chirish
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_monthly_student_group_month_unique"
    `);

    // 4. Yangi unique index — faqat ACTIVE invoicelarga qo'llaniladi
    //    CANCELLED invoice qayta yaratishga to'sqinlik qilmaydi
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invoices_monthly_student_group_month_unique"
      ON "invoices" ("studentId", "groupId", "billingMonth")
      WHERE "type" = 'monthly_fee'
        AND "groupId" IS NOT NULL
        AND "billingMonth" IS NOT NULL
        AND "status" = 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Yangi indexni o'chirish
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_monthly_student_group_month_unique"
    `);

    // Eski indexni qayta yaratish
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invoices_monthly_student_group_month_unique"
      ON "invoices" ("studentId", "groupId", "billingMonth")
      WHERE "type" = 'monthly_fee'
        AND "groupId" IS NOT NULL
        AND "billingMonth" IS NOT NULL
    `);

    // Status ustunini o'chirish
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "status"
    `);

    // Enum type o'chirish
    await queryRunner.query(`
      DROP TYPE IF EXISTS "invoices_status_enum"
    `);
  }
}
