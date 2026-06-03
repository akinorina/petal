import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoginAttemptsTable1746144005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "petal"."login_attempts" (
        "email"           VARCHAR(255) NOT NULL,
        "fail_count"      INTEGER      NOT NULL DEFAULT 0,
        "first_failed_at" TIMESTAMPTZ,
        "locked_until"    TIMESTAMPTZ,
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_login_attempts_email" PRIMARY KEY ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."login_attempts"`);
  }
}
