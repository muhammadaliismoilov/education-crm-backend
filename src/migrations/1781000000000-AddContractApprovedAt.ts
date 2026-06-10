import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: contracts jadvaliga approvedAt audit timestamp qo'shish.
 *
 * Nima qiladi:
 * 1. `approvedAt` TIMESTAMP nullable column qo'shadi
 * 2. status + branchId bo'yicha composite index qo'shadi (list filtrlash uchun)
 * 3. Mavjud APPROVED/SIGNED shartnomalar uchun approvedAt = updatedAt bilan backfill qiladi
 *    (aniq vaqt yo'q bo'lgani uchun updatedAt eng yaqin taxminiy qiymat)
 */
export class AddContractApprovedAt1781000000000 implements MigrationInterface {
  name = 'AddContractApprovedAt1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. approvedAt column qo'shish
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);

    // 2. Mavjud tasdiqlangan shartnomalarni backfill qilish
    //    APPROVED yoki SIGNED bo'lgan, lekin approvedAt NULL bo'lganlar uchun
    //    updatedAt eng yaqin taxminiy qiymat sifatida ishlatiladi
    await queryRunner.query(`
      UPDATE "contracts"
      SET "approvedAt" = "updatedAt"
      WHERE "status" IN ('APPROVED', 'SIGNED')
        AND "approvedAt" IS NULL
        AND "deletedAt" IS NULL
    `);

    // 3. Performance index: status + branchId bo'yicha filtrlash uchun
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_status_branch"
      ON "contracts" ("branchId", "status")
      WHERE "deletedAt" IS NULL AND "branchId" IS NOT NULL
    `);

    // 4. approvedAt bo'yicha index (audit va tarix so'rovlari uchun)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_approvedAt"
      ON "contracts" ("approvedAt")
      WHERE "approvedAt" IS NOT NULL AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contracts_approvedAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contracts_status_branch"`,
    );
    await queryRunner.query(`
      ALTER TABLE "contracts" DROP COLUMN IF EXISTS "approvedAt"
    `);
  }
}
