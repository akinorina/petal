import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  type ChatChunk,
  type ChatGenerationInput,
  type ChatResult,
} from '../domain/llm-generation';
import { LlmModelSchema, type LlmModel } from '../domain/llm-model';
import type { LlmProvider } from '../domain/llm-provider';
import { LlmConfig } from './llm.config';

// OpenAI 互換 API（LM Studio 等のローカル LLM）への接続クライアント。
// 公式 openai SDK を baseURL 上書きで利用する。外部 SDK 呼び出しはこの infra に隔離する。
@Injectable()
export class OpenAiCompatibleClient implements LlmProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string | undefined;

  constructor(config: LlmConfig) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.defaultModel = config.defaultModel;
  }

  async listModels(): Promise<LlmModel[]> {
    const page = await this.client.models.list();
    // SDK 応答（外部入力）を Zod で検証してマップする。
    return page.data.map((model) =>
      LlmModelSchema.parse({ id: model.id, ownedBy: model.owned_by }),
    );
  }

  async *generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk> {
    const model = this.resolveModel(input.model);
    const messages: ChatCompletionMessageParam[] = input.messages.map(
      (message) => ({ role: message.role, content: message.content }),
    );

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      stream: true,
    });

    let finishReason: string | null = null;
    let responseModel = model;
    for await (const chunk of stream) {
      if (chunk.model) {
        responseModel = chunk.model;
      }
      const choice = chunk.choices[0];
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
      const delta = choice?.delta?.content ?? '';
      if (delta.length > 0) {
        yield { delta, done: false };
      }
    }

    // 終端チャンク。finishReason/model は終端にのみ載せる。
    yield { delta: '', done: true, finishReason, model: responseModel };
  }

  async generate(input: ChatGenerationInput): Promise<ChatResult> {
    let content = '';
    let model = this.resolveModel(input.model);
    let finishReason: string | null = null;

    // generateStream を単一コードパスで集約する。
    for await (const chunk of this.generateStream(input)) {
      content += chunk.delta;
      if (chunk.done) {
        finishReason = chunk.finishReason ?? null;
        if (chunk.model) {
          model = chunk.model;
        }
      }
    }

    return { model, content, finishReason };
  }

  // 入力 model → LLM_MODEL の順で解決。どちらも無ければエラー。
  private resolveModel(inputModel: string | undefined): string {
    const model = inputModel ?? this.defaultModel;
    if (!model) {
      throw new Error(
        'モデルが指定されていません。入力の model か環境変数 LLM_MODEL を設定してください。',
      );
    }
    return model;
  }
}
