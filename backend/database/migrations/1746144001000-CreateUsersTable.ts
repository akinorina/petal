import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1746144001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "petal"."user_role" AS ENUM ('admin', 'user')
    `);
    await queryRunner.query(`
      CREATE TABLE "petal"."users" (
        "id"          UUID                NOT NULL DEFAULT gen_random_uuid(),
        "cognito_sub" VARCHAR(255)        NOT NULL,
        "name"        VARCHAR(100)        NOT NULL,
        "name_kana"   VARCHAR(100)        NOT NULL,
        "role"        "petal"."user_role" NOT NULL DEFAULT 'user',
        "created_at"  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "PK_users_id"         PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_cognito_sub" UNIQUE ("cognito_sub")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "petal"."user_role"`);
  }
}
