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

export class MfaChallengeResponseDto {
  @ApiProperty({ enum: ['MFA_REQUIRED'] })
  status!: 'MFA_REQUIRED';
  @ApiProperty({ enum: ['SOFTWARE_TOKEN_MFA'] })
  challengeName!: 'SOFTWARE_TOKEN_MFA';
  session!: string;
  email!: string;
}

export type LoginResponseDto =
  | AuthenticatedResponseDto
  | ChallengeResponseDto
  | MfaChallengeResponseDto;

export class NewPasswordChallengeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  newPassword!: string;
  session!: string;
}

export class SignupRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  password!: string;
  name!: string;
  nameKana!: string;
}

export class ConfirmSignupRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  code!: string;
  name!: string;
  nameKana!: string;
}

export class SignupConfigResponseDto {
  @ApiProperty({ description: 'セルフサインアップが有効かどうか' })
  enabled!: boolean;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class ConfirmForgotPasswordRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  code!: string;
  newPassword!: string;
}

export class ChangePasswordRequestDto {
  previousPassword!: string;
  proposedPassword!: string;
}

export class RefreshRequestDto {
  refreshToken!: string;
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class RefreshResponseDto {
  accessToken!: string;
  idToken!: string;
  expiresIn!: number;
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class MfaSetupResponseDto {
  secretCode!: string;
  otpauthUri!: string;
}

export class MfaVerifyRequestDto {
  code!: string;
}

export class MfaChallengeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  code!: string;
  session!: string;
}
