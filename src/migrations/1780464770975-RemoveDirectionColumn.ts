import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDirectionColumn1780464770975 implements MigrationInterface {
    name = 'RemoveDirectionColumn1780464770975'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN IF EXISTS "direction"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" ADD "direction" character varying`);
    }
}
