import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenContracts1778260000000 implements MigrationInterface {
  name = 'HardenContracts1778260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contractNumber" integer`,
    );

    await queryRunner.query(`
      WITH existing_max AS (
        SELECT "branchId", COALESCE(MAX("contractNumber"), 0) AS max_number
        FROM "contracts"
        GROUP BY "branchId"
      ),
      numbered AS (
        SELECT
          c.id,
          COALESCE(em.max_number, 0)
            + ROW_NUMBER() OVER (PARTITION BY c."branchId" ORDER BY c."createdAt", c.id)
            AS new_number
        FROM "contracts" c
        LEFT JOIN existing_max em
          ON c."branchId" IS NOT DISTINCT FROM em."branchId"
        WHERE c."contractNumber" IS NULL
      )
      UPDATE "contracts" c
      SET "contractNumber" = numbered.new_number
      FROM numbered
      WHERE c.id = numbered.id
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          "branchId",
          "contractNumber",
          ROW_NUMBER() OVER (
            PARTITION BY "branchId", "contractNumber"
            ORDER BY "createdAt", id
          ) AS duplicate_rank,
          COALESCE(MAX("contractNumber") OVER (PARTITION BY "branchId"), 0) AS max_number
        FROM "contracts"
        WHERE "deletedAt" IS NULL
      ),
      to_fix AS (
        SELECT
          id,
          max_number
            + ROW_NUMBER() OVER (PARTITION BY "branchId" ORDER BY "contractNumber", id)
            AS new_number
        FROM ranked
        WHERE duplicate_rank > 1
      )
      UPDATE "contracts" c
      SET "contractNumber" = to_fix.new_number
      FROM to_fix
      WHERE c.id = to_fix.id
    `);

    await queryRunner.query(
      `ALTER TABLE "contracts" ALTER COLUMN "contractNumber" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ALTER COLUMN "contractNumber" SET NOT NULL`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.crm_contract_text_to_jsonb(value text)
      RETURNS jsonb
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE
        parsed jsonb;
      BEGIN
        IF value IS NULL THEN
          RETURN NULL;
        END IF;

        BEGIN
          parsed := value::jsonb;
          IF jsonb_typeof(parsed) = 'object' THEN
            RETURN parsed;
          END IF;
        EXCEPTION WHEN others THEN
          NULL;
        END;

        RETURN jsonb_build_object('title', 'Shartnoma', 'body', value);
      END;
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'contracts'
            AND column_name = 'content'
            AND udt_name <> 'jsonb'
        ) THEN
          ALTER TABLE "contracts"
          ALTER COLUMN "content" TYPE jsonb
          USING public.crm_contract_text_to_jsonb("content");
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'contract_templates'
            AND column_name = 'content'
            AND udt_name <> 'jsonb'
        ) THEN
          ALTER TABLE "contract_templates"
          ALTER COLUMN "content" TYPE jsonb
          USING public.crm_contract_text_to_jsonb("content");
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `DROP FUNCTION public.crm_contract_text_to_jsonb(text)`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_contracts_active_branch_number_unique"
      ON "contracts" ("branchId", "contractNumber")
      WHERE "deletedAt" IS NULL AND "branchId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_active_student"
      ON "contracts" ("studentId")
      WHERE "deletedAt" IS NULL AND "studentId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_active_branch_created"
      ON "contracts" ("branchId", "createdAt" DESC)
      WHERE "deletedAt" IS NULL AND "branchId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_templates_active_branch_created"
      ON "contract_templates" ("branchId", "createdAt" DESC)
      WHERE "deletedAt" IS NULL AND "branchId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contract_templates_active_branch_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contracts_active_branch_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contracts_active_student"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contracts_active_branch_number_unique"`,
    );
  }
}
