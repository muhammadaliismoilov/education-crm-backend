import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migratsiya: phone, documentNumber, pinfl maydonlaridan
 * unique constraintlar va indexlarni olib tashlash.
 *
 * Endi bir xil telefon, JSHSHIR yoki seriya nomer bilan
 * bir nechta talaba qo'shish mumkin.
 */
export class RemoveUniqueConstraints1779530000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. phone uchun unique index ni olib tashlash
    //    TypeORM unique index nomi odatda: IDX_<table>_<column> yoki UQ_<hash>
    //    Hamma holatni qoplash uchun pg_indexes dan topamiz va o'chiramiz
    await this.dropUniqueConstraintsAndIndexes(queryRunner, 'students', 'phone');

    // 2. documentNumber uchun unique constraint ni olib tashlash
    await this.dropUniqueConstraintsAndIndexes(
      queryRunner,
      'students',
      'documentNumber',
    );

    // 3. pinfl uchun unique index ni olib tashlash
    await this.dropUniqueConstraintsAndIndexes(queryRunner, 'students', 'pinfl');

    // 4. phone uchun oddiy (unique bo'lmagan) index qo'shish — qidiruv tezligi uchun
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_students_phone" ON "students" ("phone")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Oddiy phone indexni o'chirish
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_students_phone"
    `);

    // Unique constraintlarni qaytarish
    await queryRunner.query(`
      ALTER TABLE "students"
      ADD CONSTRAINT "UQ_students_phone" UNIQUE ("phone")
    `);

    await queryRunner.query(`
      ALTER TABLE "students"
      ADD CONSTRAINT "UQ_students_documentNumber" UNIQUE ("documentNumber")
    `);

    // pinfl uchun conditional unique index qaytarish
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_students_pinfl_unique"
      ON "students" ("pinfl")
      WHERE "pinfl" IS NOT NULL
    `);
  }

  /**
   * Berilgan ustun uchun barcha unique constraintlar va indexlarni topib o'chiradi.
   * Bu TypeORM generatsiya qilgan turli nomdagi constraintlarni qoplaydi.
   */
  private async dropUniqueConstraintsAndIndexes(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    // 1. Unique constraintlarni topib o'chirish
    const constraints = await queryRunner.query(
      `
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = rel.oid
      WHERE rel.relname = $1
        AND att.attname = $2
        AND con.contype = 'u'
        AND nsp.nspname = 'public'
      `,
      [tableName, columnName],
    );

    for (const row of constraints) {
      await queryRunner.query(
        `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${row.conname}"`,
      );
    }

    // 2. Unique indexlarni topib o'chirish
    const indexes = await queryRunner.query(
      `
      SELECT i.relname AS index_name
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = $1
        AND a.attname = $2
        AND ix.indisunique = true
        AND n.nspname = 'public'
      `,
      [tableName, columnName],
    );

    for (const row of indexes) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "public"."${row.index_name}"`,
      );
    }
  }
}
