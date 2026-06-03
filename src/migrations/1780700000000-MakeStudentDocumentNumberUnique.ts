import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeStudentDocumentNumberUnique1780700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. UQ index qo'shishdan oldin mavjud faol dublikatlarni tozalash (Senior Approach)
    // Eng so'nggi yaratilgan faol talabaning hujjat raqami saqlab qolinadi.
    // Qolgan eski dublikatlarga '_DUP_' va UUID qismi qo'shib unikal qilinadi.
    await queryRunner.query(`
      WITH ranked_students AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "documentNumber"
                 ORDER BY "createdAt" DESC, id
               ) as rn
        FROM students
        WHERE "deletedAt" IS NULL AND "documentNumber" IS NOT NULL
      )
      UPDATE students
      SET "documentNumber" = "documentNumber" || '_DUP_' || SUBSTRING(id::text, 1, 8)
      WHERE id IN (
        SELECT id 
        FROM ranked_students 
        WHERE rn > 1
      );
    `);

    // 2. Partial unique index yaratish (o'chirilganlarni va null larni hisobga olmaydi)
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
