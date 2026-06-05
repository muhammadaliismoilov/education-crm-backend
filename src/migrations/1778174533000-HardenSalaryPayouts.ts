import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenSalaryPayouts1778174533000 implements MigrationInterface {
  name = 'HardenSalaryPayouts1778174533000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasType = await queryRunner.query(`SELECT 1 FROM pg_type WHERE typname = 'salary_payouts_status_enum'`);
    if (hasType.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."salary_payouts_status_enum" AS ENUM('PAID', 'CANCELLED')`,
      );
    }

    const hasStatus = await queryRunner.hasColumn('salary_payouts', 'status');
    if (!hasStatus) {
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ADD "status" "public"."salary_payouts_status_enum" NOT NULL DEFAULT 'PAID'`,
      );
    }

    const hasCalcDetails = await queryRunner.hasColumn('salary_payouts', 'calculationDetails');
    if (!hasCalcDetails) {
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ADD "calculationDetails" jsonb`,
      );
    }

    const hasPaidById = await queryRunner.hasColumn('salary_payouts', 'paidById');
    if (!hasPaidById) {
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ADD "paidById" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "salary_payouts" ADD CONSTRAINT "FK_salary_payouts_paidBy" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }

    const indices = await queryRunner.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'salary_payouts' AND indexname = 'UQ_salary_payouts_teacher_branch_range_paid'`);
    if (indices.length === 0) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_salary_payouts_teacher_branch_range_paid" ON "salary_payouts" ("teacherId", COALESCE("branchId", '00000000-0000-0000-0000-000000000000'::uuid), "startDate", "endDate") WHERE "status" = 'PAID'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_salary_payouts_teacher_branch_range_paid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_payouts" DROP CONSTRAINT "FK_salary_payouts_paidBy"`,
    );
    await queryRunner.query(`ALTER TABLE "salary_payouts" DROP COLUMN "paidById"`);
    await queryRunner.query(
      `ALTER TABLE "salary_payouts" DROP COLUMN "calculationDetails"`,
    );
    await queryRunner.query(`ALTER TABLE "salary_payouts" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."salary_payouts_status_enum"`);
  }
}
