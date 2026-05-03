export class LoginRequestDto {
  email: string;
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
}
