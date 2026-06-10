import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1746144006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "petal"."chat_threads" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "owner_user_id" UUID          NOT NULL,
        "title"         VARCHAR(255),
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_chat_threads_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_threads_owner_user_id" FOREIGN KEY ("owner_user_id")
          REFERENCES "petal"."users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_threads_owner_created"
        ON "petal"."chat_threads" ("owner_user_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE "petal"."chat_messages" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "thread_id"  UUID         NOT NULL,
        "seq"        BIGINT       NOT NULL,
        "role"       VARCHAR(20)  NOT NULL,
        "content"    TEXT         NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_messages_thread_seq" UNIQUE ("thread_id", "seq"),
        CONSTRAINT "CK_chat_messages_role" CHECK ("role" IN ('system', 'user', 'assistant')),
        CONSTRAINT "FK_chat_messages_thread_id" FOREIGN KEY ("thread_id")
          REFERENCES "petal"."chat_threads"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."chat_messages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "petal"."IDX_chat_threads_owner_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."chat_threads"`);
  }
}
