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
