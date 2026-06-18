import Anthropic from '@anthropic-ai/sdk';
import {
  type ChatChunk,
  type ChatGenerationInput,
  type ChatResult,
} from '../domain/llm-generation';
import { contentToText } from '../domain/llm-message';
import { LlmModelSchema, type LlmModel } from '../domain/llm-model';
import type { LlmProvider } from '../domain/llm-provider';
import type { ClaudeConfig } from './llm.config';

// Anthropic Messages API は max_tokens 必須のため、入力にも既定にも無い場合の既定値。
const DEFAULT_MAX_TOKENS = 8192;

// Claude（Anthropic Messages API）への接続クライアント。
// 外部 SDK 呼び出しはこの infra に隔離する。レジストリが config を渡して new する。
export class ClaudeClient implements LlmProvider {
  private cachedClient: Anthropic | undefined;
  private readonly defaultModel: string | undefined;

  constructor(private readonly config: ClaudeConfig) {
    this.defaultModel = config.defaultModel;
  }

  // 遅延初期化。API キー未設定時はチャット利用時のみ明確なエラーを返す。
  private get client(): Anthropic {
    if (!this.config.apiKey) {
      throw new Error(
        'LLM(Claude) が未設定です。環境変数 CLAUDE_API_KEY を設定してください。',
      );
    }
    this.cachedClient ??= new Anthropic({ apiKey: this.config.apiKey });
    return this.cachedClient;
  }

  async listModels(): Promise<LlmModel[]> {
    const models: LlmModel[] = [];
    for await (const model of this.client.models.list()) {
      // SDK 応答（外部入力）を Zod で検証。Anthropic に owner 概念は無いため null。
      models.push(LlmModelSchema.parse({ id: model.id, ownedBy: null }));
    }
    return models;
  }

  async *generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk> {
    const model = this.resolveModel(input.model);
    const { system, messages } = this.splitMessages(input.messages);

    // temperature は転送しない（Opus 4.8/4.7 は temperature を 400 で拒否する）。
    // thinking も渡さない（思考の深さ制御は本タスクのスコープ外）。
    const stream = this.client.messages.stream({
      model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system === undefined ? {} : { system }),
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const delta = event.delta.text;
        if (delta.length > 0) {
          yield { delta, done: false };
        }
      }
    }

    const final = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      finishReason: final.stop_reason,
      model: final.model,
    };
  }

  async generate(input: ChatGenerationInput): Promise<ChatResult> {
    let content = '';
    let model = this.resolveModel(input.model);
    let finishReason: string | null = null;

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

  // system ロールのメッセージは Anthropic の system フィールドへ分離し、
  // 残りを user/assistant メッセージへマップする。
  private splitMessages(messages: ChatGenerationInput['messages']): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    const systemParts: string[] = [];
    const mapped: Anthropic.MessageParam[] = [];
    for (const message of messages) {
      const text = contentToText(message.content);
      if (message.role === 'system') {
        systemParts.push(text);
      } else {
        mapped.push({ role: message.role, content: text });
      }
    }
    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages: mapped,
    };
  }

  // 入力 model → CLAUDE_MODEL の順で解決。どちらも無ければエラー。
  private resolveModel(inputModel: string | undefined): string {
    const model = inputModel ?? this.defaultModel;
    if (!model) {
      throw new Error(
        'モデルが指定されていません。入力の model か環境変数 CLAUDE_MODEL を設定してください。',
      );
    }
    return model;
  }
}
