import { Module } from '@nestjs/common';
import { ChatService } from './application/chat.service';
import { LLM_PROVIDER } from './domain/llm-provider';
import { LlmConfig } from './infra/llm.config';
import { OpenAiCompatibleClient } from './infra/openai-compatible.client';

@Module({
  providers: [
    LlmConfig,
    {
      provide: LLM_PROVIDER,
      useClass: OpenAiCompatibleClient,
    },
    ChatService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
