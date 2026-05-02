import { UserRole } from './user-role.enum.js';

export class User {
  constructor(
    readonly id: string,
    readonly cognitoSub: string,
    public name: string,
    public nameKana: string,
    public role: UserRole,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}
}
