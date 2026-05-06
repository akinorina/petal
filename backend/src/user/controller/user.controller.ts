import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from '../application/user.service';
import {
  CreateUserSchema,
  ListUsersQuerySchema,
  UpdateUserSchema,
} from '../application/user.schemas';
import { User } from '../domain/user';
import {
  CreateUserRequestDto,
  ListUsersQueryDto,
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
