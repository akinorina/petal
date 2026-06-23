import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessageAudios1746144009000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "petal"."chat_message_audios" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "message_id" UUID         NOT NULL,
        "audio_id"   UUID         NOT NULL,
        "position"   INT          NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_chat_message_audios_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_message_audios_message_position" UNIQUE ("message_id", "position"),
        CONSTRAINT "FK_chat_message_audios_message_id" FOREIGN KEY ("message_id")
          REFERENCES "petal"."chat_messages"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_chat_message_audios_audio_id" FOREIGN KEY ("audio_id")
          REFERENCES "petal"."audios"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_message_audios_message"
        ON "petal"."chat_message_audios" ("message_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "petal"."IDX_chat_message_audios_message"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "petal"."chat_message_audios"`,
    );
  }
}
