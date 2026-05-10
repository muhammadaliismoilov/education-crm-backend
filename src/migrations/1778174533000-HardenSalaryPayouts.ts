import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenSalaryPayouts1778174533000 implements MigrationInterface {
  name = 'HardenSalaryPayouts1778174533000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasType = await queryRunner.query(`SELECT 1 FROM pg_type WHERE typname = 'salaryPayouts_status_enum'`);
    if (hasType.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."salaryPayouts_status_enum" AS ENUM('PAID', 'CANCELLED')`,
      );
    }

    const hasStatus = await queryRunner.hasColumn('salaryPayouts', 'status');
    if (!hasStatus) {
      await queryRunner.query(
        `ALTER TABLE "salaryPayouts" ADD "status" "public"."salaryPayouts_status_enum" NOT NULL DEFAULT 'PAID'`,
      );
    }

    const hasCalcDetails = await queryRunner.hasColumn('salaryPayouts', 'calculationDetails');
    if (!hasCalcDetails) {
      await queryRunner.query(
        `ALTER TABLE "salaryPayouts" ADD "calculationDetails" jsonb`,
      );
    }

    const hasPaidById = await queryRunner.hasColumn('salaryPayouts', 'paidById');
    if (!hasPaidById) {
      await queryRunner.query(
        `ALTER TABLE "salaryPayouts" ADD "paidById" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "salaryPayouts" ADD CONSTRAINT "FK_salaryPayouts_paidBy" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }

    const indices = await queryRunner.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'salaryPayouts' AND indexname = 'UQ_salaryPayouts_teacher_branch_range_paid'`);
    if (indices.length === 0) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_salaryPayouts_teacher_branch_range_paid" ON "salaryPayouts" ("teacherId", COALESCE("branchId", '00000000-0000-0000-0000-000000000000'::uuid), "startDate", "endDate") WHERE "status" = 'PAID'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_salaryPayouts_teacher_branch_range_paid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" DROP CONSTRAINT "FK_salaryPayouts_paidBy"`,
    );
    await queryRunner.query(`ALTER TABLE "salaryPayouts" DROP COLUMN "paidById"`);
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" DROP COLUMN "calculationDetails"`,
    );
    await queryRunner.query(`ALTER TABLE "salaryPayouts" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."salaryPayouts_status_enum"`);
  }
}
