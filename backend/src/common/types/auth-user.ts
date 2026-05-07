import { UserRole } from '../../user/domain/user-role.enum';

export type AuthUser = {
  sub: string;
  userId: string;
  email: string;
  role: UserRole;
};

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
