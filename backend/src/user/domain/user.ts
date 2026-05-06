import { z } from 'zod';
import { UserRole } from './user-role.enum';

export const UserSchema = z.object({
  id: z.uuid(),
  cognitoSub: z.string().min(1),
  email: z.email(),
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.enum(UserRole),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type UserProps = z.infer<typeof UserSchema>;

export class User {
  readonly id: string;
  readonly cognitoSub: string;
  readonly email: string;
  name: string;
  nameKana: string;
  role: UserRole;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: UserProps) {
    const validated = UserSchema.parse(props);
    this.id = validated.id;
    this.cognitoSub = validated.cognitoSub;
    this.email = validated.email;
    this.name = validated.name;
    this.nameKana = validated.nameKana;
    this.role = validated.role;
    this.createdAt = validated.createdAt;
    this.updatedAt = validated.updatedAt;
    this.deletedAt = validated.deletedAt;
  }
}
