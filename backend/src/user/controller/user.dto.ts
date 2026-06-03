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
    description:
      'true なら Cognito の UserStatus=FORCE_CHANGE_PASSWORD（招待保留中）。' +
      ' 一覧/個別取得・作成・更新・復活エンドポイントで返る。GET /users/me と PATCH /users/me では常に false。' +
      ' softDelete 済みも常に false。',
  })
  invitationPending!: boolean;
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
  @ApiProperty({ required: false, default: 20 })
  limit?: number;
  @ApiProperty({ required: false, default: 0 })
  offset?: number;
  @ApiProperty({
    required: false,
    description: 'email / name / nameKana の部分一致（大文字小文字無視）',
  })
  q?: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', required: false })
  role?: UserRole;
  @ApiProperty({ enum: ['true', 'false'], required: false, default: 'false' })
  deleted?: 'true' | 'false';
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
}

export class RequestEmailChangeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class ConfirmEmailChangeRequestDto {
  code!: string;
}
