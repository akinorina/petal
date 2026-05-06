import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailToUsers1746144003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "petal"."users"
        ADD COLUMN "email" VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "petal"."users"
        ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "petal"."users"
        DROP CONSTRAINT IF EXISTS "UQ_users_email"
    `);
    await queryRunner.query(`
      ALTER TABLE "petal"."users"
        DROP COLUMN IF EXISTS "email"
    `);
  }
}
