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
} from '@nestjs/common';
import { UserService } from '../../application/user/user.service';
import {
  CreateUserSchema,
  UpdateUserSchema,
} from '../../application/user/user.schemas';
import { User } from '../../domain/user/user';
import {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  UserResponseDto,
} from './user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userService.findAll();
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
}

function toResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    cognitoSub: user.cognitoSub,
    name: user.name,
    nameKana: user.nameKana,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}
