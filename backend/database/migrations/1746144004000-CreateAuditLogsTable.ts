import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1746144004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "petal"."audit_action" AS ENUM (
        'CREATE_USER',
        'UPDATE_USER',
        'DELETE_USER',
        'RESTORE_USER'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "petal"."audit_logs" (
        "id"             UUID                    NOT NULL DEFAULT gen_random_uuid(),
        "actor_user_id"  UUID                    NOT NULL,
        "action"         "petal"."audit_action"  NOT NULL,
        "target_user_id" UUID,
        "metadata"       JSONB,
        "created_at"     TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_audit_logs_id"     PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_actor"  FOREIGN KEY ("actor_user_id")  REFERENCES "petal"."users"("id"),
        CONSTRAINT "FK_audit_logs_target" FOREIGN KEY ("target_user_id") REFERENCES "petal"."users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at"
        ON "petal"."audit_logs" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_target"
        ON "petal"."audit_logs" ("target_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor"
        ON "petal"."audit_logs" ("actor_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "petal"."audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "petal"."audit_action"`);
  }
}
