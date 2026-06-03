import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'petal', name: 'login_attempts' })
export class LoginAttemptEntity {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'fail_count', type: 'int', default: 0 })
  failCount!: number;

  @Column({ name: 'first_failed_at', type: 'timestamptz', nullable: true })
  firstFailedAt!: Date | null;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
