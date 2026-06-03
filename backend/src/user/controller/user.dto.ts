import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../domain/user-role.enum';

export class UserResponseDto {
  id!: string;
  cognitoSub!: string;
  email!: string;
  name!: string;
  nameKana!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true })
  deletedAt!: string | null;
  @ApiProperty({
    required: false,
    description:
      '自分自身（GET /users/me）にのみセットされる。MFA(TOTP) 有効状態。',
  })
  mfaEnabled?: boolean;
}

export class CreateUserRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  name!: string;
  nameKana!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', required: false })
  role?: UserRole;
}

export class UpdateUserRequestDto {
  name?: string;
  nameKana?: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', required: false })
  role?: UserRole;
}

export class UpdateMyProfileRequestDto {
  name?: string;
  nameKana?: string;
}

export class ListUsersQueryDto {
  @ApiProperty({ enum: ['true', 'false'], required: false })
  deleted?: 'true' | 'false';
}

export class RequestEmailChangeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class ConfirmEmailChangeRequestDto {
  code!: string;
}
