import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { ChatService } from './application/chat.service';
import { ChatCompletionService } from './application/chat-completion.service';
import { ChatThreadService } from './application/chat-thread.service';
import { LlmProviderRegistry } from './application/llm-provider.registry';
import { ChatController } from './controller/chat.controller';
import { CHAT_THREAD_REPOSITORY } from './domain/chat-thread.repository';
import { LLM_PROVIDER, LLM_PROVIDER_REGISTRY } from './domain/llm-provider';
import { ChatMessageEntity } from './infra/chat-message.entity';
import { ChatThreadEntity } from './infra/chat-thread.entity';
import { ChatThreadRepositoryImpl } from './infra/chat-thread.repository.impl';
import { LlmConfig } from './infra/llm.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatThreadEntity, ChatMessageEntity]),
    UserModule,
  ],
  controllers: [ChatController],
  providers: [
    LlmConfig,
    LlmProviderRegistry,
    // レジストリ本体を引ける DI トークン（将来のリクエスト単位アクセス用）。
    { provide: LLM_PROVIDER_REGISTRY, useExisting: LlmProviderRegistry },
    // Chat が使う有効 provider（env LLM_PROVIDER で指定された 1 つ）。
    {
      provide: LLM_PROVIDER,
      useFactory: (registry: LlmProviderRegistry) => registry.getActive(),
      inject: [LlmProviderRegistry],
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
