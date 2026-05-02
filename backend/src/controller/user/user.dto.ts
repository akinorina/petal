import { UserRole } from '../../domain/user/user-role.enum';

export class UserResponseDto {
  id!: string;
  cognitoSub!: string;
  name!: string;
  nameKana!: string;
  role!: UserRole;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
}

export class CreateUserRequestDto {
  cognitoSub!: string;
  name!: string;
  nameKana!: string;
  role?: UserRole;
}

export class UpdateUserRequestDto {
  name?: string;
  nameKana?: string;
  role?: UserRole;
}
