import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { ChatService } from './application/chat.service';
import { ChatCompletionService } from './application/chat-completion.service';
import { ChatThreadService } from './application/chat-thread.service';
import { ChatController } from './controller/chat.controller';
import { CHAT_THREAD_REPOSITORY } from './domain/chat-thread.repository';
import { LLM_PROVIDER } from './domain/llm-provider';
import { ChatMessageEntity } from './infra/chat-message.entity';
import { ChatThreadEntity } from './infra/chat-thread.entity';
import { ChatThreadRepositoryImpl } from './infra/chat-thread.repository.impl';
import { LlmConfig } from './infra/llm.config';
import { OpenAiCompatibleClient } from './infra/openai-compatible.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatThreadEntity, ChatMessageEntity]),
    UserModule,
  ],
  controllers: [ChatController],
  providers: [
    LlmConfig,
    {
      provide: LLM_PROVIDER,
      useClass: OpenAiCompatibleClient,
    },
    ChatService,
    {
      provide: CHAT_THREAD_REPOSITORY,
      useClass: ChatThreadRepositoryImpl,
    },
    ChatThreadService,
    ChatCompletionService,
  ],
  exports: [ChatService, ChatThreadService],
})
export class ChatModule {}
