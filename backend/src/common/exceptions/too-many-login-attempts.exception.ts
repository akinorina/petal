import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyLoginAttemptsException extends HttpException {
  constructor(
    message = 'ログイン試行回数が上限に達しました。しばらくしてから再度お試しください',
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
