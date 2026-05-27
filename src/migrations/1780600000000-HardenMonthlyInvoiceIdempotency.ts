import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenMonthlyInvoiceIdempotency1780600000000
  implements MigrationInterface
{
  name = 'HardenMonthlyInvoiceIdempotency1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "billingMonth" date
    `);

    await queryRunner.query(`
      UPDATE "invoices"
      SET "billingMonth" = make_date(
        EXTRACT(YEAR FROM ("createdAt" AT TIME ZONE 'Asia/Tashkent'))::int,
        EXTRACT(MONTH FROM ("createdAt" AT TIME ZONE 'Asia/Tashkent'))::int,
        1
      )
      WHERE "type" = 'monthly_fee'
        AND "billingMonth" IS NULL
        AND "createdAt" IS NOT NULL
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          i.id,
          i."studentId",
          ROW_NUMBER() OVER (
            PARTITION BY i."studentId", i."groupId", i."billingMonth"
            ORDER BY i."createdAt", i.id
          ) AS duplicate_rank
        FROM "invoices" i
        WHERE i."type" = 'monthly_fee'
          AND i."studentId" IS NOT NULL
          AND i."groupId" IS NOT NULL
          AND i."billingMonth" IS NOT NULL
      ),
      to_delete AS (
        SELECT id
        FROM ranked
        WHERE duplicate_rank > 1
      ),
      deleted_rows AS (
        DELETE FROM "invoices" d
        USING to_delete td
        WHERE d.id = td.id
        RETURNING d."studentId"
      ),
      affected_students AS (
        SELECT DISTINCT "studentId" AS id
        FROM deleted_rows
        WHERE "studentId" IS NOT NULL
      ),
      payment_totals AS (
        SELECT p."studentId" AS id, SUM(CAST(p."amount" AS DECIMAL)) AS total_paid
        FROM "payments" p
        WHERE p."studentId" IN (SELECT id FROM affected_students)
        GROUP BY p."studentId"
      ),
      invoice_totals AS (
        SELECT i."studentId" AS id, SUM(CAST(i."amount" AS DECIMAL)) AS total_invoiced
        FROM "invoices" i
        WHERE i."studentId" IN (SELECT id FROM affected_students)
        GROUP BY i."studentId"
      )
      UPDATE "students" s
      SET "balance" = COALESCE(payment_totals.total_paid, 0) - COALESCE(invoice_totals.total_invoiced, 0)
      FROM affected_students
      LEFT JOIN payment_totals ON payment_totals.id = affected_students.id
      LEFT JOIN invoice_totals ON invoice_totals.id = affected_students.id
      WHERE s.id = affected_students.id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoices_monthly_student_group_month_unique"
      ON "invoices" ("studentId", "groupId", "billingMonth")
      WHERE "type" = 'monthly_fee'
        AND "groupId" IS NOT NULL
        AND "billingMonth" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_monthly_student_group_month_unique"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "billingMonth"
    `);
  }
}
