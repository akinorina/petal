import { ConflictException } from '@nestjs/common';

export class LastAdminConflictException extends ConflictException {
  constructor(message = '最後の admin は削除/降格できません') {
    super(message);
  }
}
