import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenSalaryPayouts1778174533000 implements MigrationInterface {
  name = 'HardenSalaryPayouts1778174533000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."salaryPayouts_status_enum" AS ENUM('PAID', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" ADD "status" "public"."salaryPayouts_status_enum" NOT NULL DEFAULT 'PAID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" ADD "calculationDetails" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" ADD "paidById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "salaryPayouts" ADD CONSTRAINT "FK_salaryPayouts_paidBy" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_salaryPayouts_teacher_branch_range_paid" ON "salaryPayouts" ("teacherId", COALESCE("branchId", '00000000-0000-0000-0000-000000000000'::uuid), "startDate", "endDate") WHERE "status" = 'PAID'`,
    );
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
