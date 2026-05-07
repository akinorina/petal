import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserService } from '../application/user.service';
import {
  ConfirmEmailChangeSchema,
  CreateUserSchema,
  ListUsersQuerySchema,
  RequestEmailChangeSchema,
  UpdateUserSchema,
} from '../application/user.schemas';
import { User } from '../domain/user';
import {
  ConfirmEmailChangeRequestDto,
  CreateUserRequestDto,
  ListUsersQueryDto,
  RequestEmailChangeRequestDto,
  UpdateUserRequestDto,
  UserResponseDto,
} from './user.dto';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<UserResponseDto[]> {
    const parsed = ListUsersQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const users = parsed.data.deleted
      ? await this.userService.findAllDeleted()
      : await this.userService.findAll();
    return users.map(toResponse);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return toResponse(await this.userService.findById(id));
  }

  @Post()
  async create(@Body() body: CreateUserRequestDto): Promise<UserResponseDto> {
    const result = CreateUserSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return toResponse(await this.userService.create(result.data));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const result = UpdateUserSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return toResponse(await this.userService.update(id, result.data));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.userService.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  async restore(@Param('id') id: string): Promise<UserResponseDto> {
    return toResponse(await this.userService.restore(id));
  }

  @Patch('me/email')
  @HttpCode(204)
  async requestEmailChange(
    @Req() req: Request,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RequestEmailChangeRequestDto,
  ): Promise<void> {
    const parsed = RequestEmailChangeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const accessToken = extractBearer(authorization);
    const actor = await this.resolveCurrentUser(req);
    await this.userService.requestEmailChange(
      actor,
      parsed.data.email,
      accessToken,
    );
  }

  @Post('me/email/verify')
  @HttpCode(204)
  async confirmEmailChange(
    @Req() req: Request,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ConfirmEmailChangeRequestDto,
  ): Promise<void> {
    const parsed = ConfirmEmailChangeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const accessToken = extractBearer(authorization);
    const actor = await this.resolveCurrentUser(req);
    await this.userService.confirmEmailChange(
      actor,
      parsed.data.code,
      accessToken,
    );
  }

  private async resolveCurrentUser(req: Request): Promise<User> {
    const sub = extractCognitoSub(req);
    const user = await this.userService.findByCognitoSub(sub);
    if (!user) {
      throw new UnauthorizedException(
        '認証ユーザーに対応するレコードがありません',
      );
    }
    return user;
  }
}

function extractCognitoSub(req: Request): string {
  const payload = (req as Request & { user?: { sub?: unknown } }).user;
  const sub = payload?.sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new UnauthorizedException('認証情報が不正です');
  }
  return sub;
}

function extractBearer(authorization: string | undefined): string {
  if (!authorization) {
    throw new UnauthorizedException('Authorization ヘッダーが不正です');
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    throw new UnauthorizedException('Authorization ヘッダーが不正です');
  }
  return match[1];
}

function toResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    cognitoSub: user.cognitoSub,
    email: user.email,
    name: user.name,
    nameKana: user.nameKana,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
  };
}
