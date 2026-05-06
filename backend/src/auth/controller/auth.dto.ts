import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  password!: string;
}

export class AuthenticatedResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] })
  status!: 'AUTHENTICATED';
  accessToken!: string;
  idToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  email!: string;
}

export class ChallengeResponseDto {
  @ApiProperty({ enum: ['CHALLENGE'] })
  status!: 'CHALLENGE';
  @ApiProperty({ enum: ['NEW_PASSWORD_REQUIRED'] })
  challengeName!: 'NEW_PASSWORD_REQUIRED';
  session!: string;
  email!: string;
}

export type LoginResponseDto = AuthenticatedResponseDto | ChallengeResponseDto;

export class NewPasswordChallengeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  newPassword!: string;
  session!: string;
}
