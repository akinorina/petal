import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePetalSchema1746144000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "petal"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "petal" CASCADE`);
  }
}
