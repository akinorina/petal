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
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { User } from '../../user/domain/user';
import { UserService } from '../../user/application/user.service';
import { ChatCompletionService } from '../application/chat-completion.service';
import { SendMessageSchema } from '../application/chat.schemas';
import { ChatThreadService } from '../application/chat-thread.service';
import { CreateThreadInputSchema } from '../application/chat-thread.schemas';
import type { ChatStreamEvent } from '../application/chat-stream';
import { ChatMessage } from '../domain/chat-message';
import { ChatThread } from '../domain/chat-thread';
import {
  ChatMessageResponseDto,
  ChatThreadResponseDto,
  CreateThreadRequestDto,
  SendMessageRequestDto,
} from './chat.dto';

@ApiTags('chat')
@ApiBearerAuth('bearer')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly threadService: ChatThreadService,
    private readonly completionService: ChatCompletionService,
    private readonly userService: UserService,
  ) {}

  @Post('threads')
  async createThread(
    @Req() req: Request,
    @Body() body: CreateThreadRequestDto,
  ): Promise<ChatThreadResponseDto> {
    const result = CreateThreadInputSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const currentUser = await this.resolveCurrentUser(req);
    const thread = await this.threadService.createThread(
      currentUser,
      result.data,
    );
    return toThreadResponse(thread);
  }

  @Get('threads')
  async findThreads(@Req() req: Request): Promise<ChatThreadResponseDto[]> {
    const currentUser = await this.resolveCurrentUser(req);
    const threads = await this.threadService.findThreadsForOwner(currentUser);
    return threads.map(toThreadResponse);
  }

  @Get('threads/:id/messages')
  async findMessages(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ChatMessageResponseDto[]> {
    const currentUser = await this.resolveCurrentUser(req);
    const messages = await this.threadService.findMessages(currentUser, id);
    return messages.map(toMessageResponse);
  }

  @Post('threads/:id/messages')
  @ApiProduces('text/event-stream')
  async sendMessage(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: SendMessageRequestDto,
  ): Promise<void> {
    const result = SendMessageSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const currentUser = await this.resolveCurrentUser(req);

    const gen = this.completionService.streamCompletion(
      currentUser,
      id,
      result.data,
    );

    // 最初のイベント取得までは pre-stream。ここで throw すればヘッダー未送出のため
    // Nest の例外フィルタが HTTP ステータスで応答する。
    const first = await gen.next();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 切断検知。generator の return で orchestrator の finally が走り部分保存される。
    req.on('close', () => {
      void gen.return(undefined);
    });

    if (!first.done) {
      writeEvent(res, first.value);
      for await (const event of gen) {
        writeEvent(res, event);
      }
    }
    res.end();
  }

  @Delete('threads/:id')
  @HttpCode(204)
  async removeThread(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    const currentUser = await this.resolveCurrentUser(req);
    await this.threadService.removeThread(currentUser, id);
  }

  private async resolveCurrentUser(req: Request): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException('認証情報がありません');
    }
    return this.userService.findById(req.user.userId);
  }
}

function writeEvent(res: Response, event: ChatStreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function toThreadResponse(thread: ChatThread): ChatThreadResponseDto {
  return {
    id: thread.id,
    ownerUserId: thread.ownerUserId,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

function toMessageResponse(message: ChatMessage): ChatMessageResponseDto {
  return {
    id: message.id,
    threadId: message.threadId,
    seq: message.seq,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
