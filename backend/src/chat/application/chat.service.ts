import { Inject, Injectable } from '@nestjs/common';
import {
  ChatGenerationInputSchema,
  type ChatChunk,
  type ChatGenerationInput,
  type ChatResult,
} from '../domain/llm-generation';
import type { LlmModel } from '../domain/llm-model';
import { LLM_PROVIDER, type LlmProvider } from '../domain/llm-provider';

@Injectable()
export class ChatService {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  listModels(): Promise<LlmModel[]> {
    return this.provider.listModels();
  }

  async generate(input: ChatGenerationInput): Promise<ChatResult> {
    const parsed = ChatGenerationInputSchema.parse(input);
    return this.provider.generate(parsed);
  }

  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk> {
    const parsed = ChatGenerationInputSchema.parse(input);
    return this.provider.generateStream(parsed);
  }

  // 有効 provider が画像入力（vision）に対応しているか（provider 委譲）。
  supportsVision(): boolean {
    return this.provider.supportsVision();
  }

  // 有効 provider が音声入力に対応しているか（provider 委譲・TSK-131）。
  supportsAudio(): boolean {
    return this.provider.supportsAudio();
  }
}
