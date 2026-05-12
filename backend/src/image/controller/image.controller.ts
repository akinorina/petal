import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '../../user/domain/user';
import { UserService } from '../../user/application/user.service';
import { ImageService } from '../application/image.service';
import { CreateImageSchema } from '../application/image.schemas';
import { Image } from '../domain/image';
import {
  CreateImageRequestDto,
  CreateImageResponseDto,
  DownloadUrlResponseDto,
  ImageResponseDto,
} from './image.dto';

@ApiTags('images')
@ApiBearerAuth('bearer')
@Controller('images')
export class ImageController {
  constructor(
    private readonly imageService: ImageService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() body: CreateImageRequestDto,
  ): Promise<CreateImageResponseDto> {
    const result = CreateImageSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const currentUser = await this.resolveCurrentUser(req);
    const created = await this.imageService.createWithUploadUrl(
      currentUser,
      result.data,
    );
    return {
      image: toResponse(created.image),
      upload: created.upload,
    };
  }

  @Get()
  async findAll(@Req() req: Request): Promise<ImageResponseDto[]> {
    const currentUser = await this.resolveCurrentUser(req);
    const images = await this.imageService.findAllForOwner(currentUser);
    return images.map(toResponse);
  }

  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ImageResponseDto> {
    const currentUser = await this.resolveCurrentUser(req);
    return toResponse(await this.imageService.findOneForOwner(currentUser, id));
  }

  @Get(':id/download-url')
  async getDownloadUrl(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DownloadUrlResponseDto> {
    const currentUser = await this.resolveCurrentUser(req);
    return this.imageService.createDownloadUrl(currentUser, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const currentUser = await this.resolveCurrentUser(req);
    await this.imageService.remove(currentUser, id);
  }

  private async resolveCurrentUser(req: Request): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException('認証情報がありません');
    }
    return this.userService.findById(req.user.userId);
  }
}

function toResponse(image: Image): ImageResponseDto {
  return {
    id: image.id,
    ownerUserId: image.ownerUserId,
    originalFilename: image.originalFilename,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    title: image.title,
    description: image.description,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}
