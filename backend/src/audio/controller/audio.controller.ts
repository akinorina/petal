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
import { AudioService } from '../application/audio.service';
import { CreateAudioSchema } from '../application/audio.schemas';
import { Audio } from '../domain/audio';
import {
  CreateAudioRequestDto,
  CreateAudioResponseDto,
  DownloadUrlResponseDto,
  AudioResponseDto,
} from './audio.dto';

@ApiTags('audios')
@ApiBearerAuth('bearer')
@Controller('audios')
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() body: CreateAudioRequestDto,
  ): Promise<CreateAudioResponseDto> {
    const result = CreateAudioSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const currentUser = await this.resolveCurrentUser(req);
    const created = await this.audioService.createWithUploadUrl(
      currentUser,
      result.data,
    );
    return {
      audio: toResponse(created.audio),
      upload: created.upload,
    };
  }

  @Get()
  async findAll(@Req() req: Request): Promise<AudioResponseDto[]> {
    const currentUser = await this.resolveCurrentUser(req);
    const audios = await this.audioService.findAllForOwner(currentUser);
    return audios.map(toResponse);
  }

  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<AudioResponseDto> {
    const currentUser = await this.resolveCurrentUser(req);
    return toResponse(await this.audioService.findOneForOwner(currentUser, id));
  }

  @Get(':id/download-url')
  async getDownloadUrl(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DownloadUrlResponseDto> {
    const currentUser = await this.resolveCurrentUser(req);
    return this.audioService.createDownloadUrl(currentUser, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const currentUser = await this.resolveCurrentUser(req);
    await this.audioService.remove(currentUser, id);
  }

  private async resolveCurrentUser(req: Request): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException('認証情報がありません');
    }
    return this.userService.findById(req.user.userId);
  }
}

function toResponse(audio: Audio): AudioResponseDto {
  return {
    id: audio.id,
    ownerUserId: audio.ownerUserId,
    originalFilename: audio.originalFilename,
    mimeType: audio.mimeType,
    sizeBytes: audio.sizeBytes,
    durationSeconds: audio.durationSeconds,
    title: audio.title,
    description: audio.description,
    createdAt: audio.createdAt.toISOString(),
    updatedAt: audio.updatedAt.toISOString(),
  };
}
