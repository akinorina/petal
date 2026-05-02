export type UserRole = 'admin' | 'user';

export type User = {
  id: string;
  cognitoSub: string;
  name: string;
  nameKana: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateUserRequest = {
  cognitoSub: string;
  name: string;
  nameKana: string;
  role?: UserRole;
};

export type UpdateUserRequest = {
  name?: string;
  nameKana?: string;
  role?: UserRole;
};
