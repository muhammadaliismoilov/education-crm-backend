import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeStudentDocumentNumberUnique1780700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. O'chirilgan (soft delete) talabalarni hisobga olmaydigan va null qiymatlarga ruxsat beruvchi
    // partial unique index yaratish.
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_students_documentNumber_active";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_students_documentNumber_active" 
      ON "students" ("documentNumber") 
      WHERE "deletedAt" IS NULL AND "documentNumber" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_students_documentNumber_active";
    `);
  }
}
