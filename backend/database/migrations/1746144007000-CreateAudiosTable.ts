import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAudiosTable1746144007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "petal"."audios" (
        "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
        "owner_user_id"      UUID          NOT NULL,
        "s3_key"             VARCHAR(512)  NOT NULL,
        "original_filename"  VARCHAR(255)  NOT NULL,
        "mime_type"          VARCHAR(100)  NOT NULL,
        "size_bytes"         BIGINT        NOT NULL,
        "duration_seconds"   INTEGER,
        "title"              VARCHAR(255),
        "description"        VARCHAR(1000),
        "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "PK_audios_id"        PRIMARY KEY ("id"),
        CONSTRAINT "UQ_audios_s3_key"    UNIQUE ("s3_key"),
        CONSTRAINT "CK_audios_size_bytes" CHECK ("size_bytes" > 0),
        CONSTRAINT "CK_audios_duration_seconds" CHECK ("duration_seconds" > 0),
        CONSTRAINT "FK_audios_owner_user_id" FOREIGN KEY ("owner_user_id")
          REFERENCES "petal"."users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audios_owner_created"
        ON "petal"."audios" ("owner_user_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "petal"."IDX_audios_owner_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."audios"`);
  }
}
