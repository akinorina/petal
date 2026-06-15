import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  type ChatChunk,
  type ChatGenerationInput,
  type ChatResult,
} from '../domain/llm-generation';
import { LlmModelSchema, type LlmModel } from '../domain/llm-model';
import type { LlmProvider } from '../domain/llm-provider';
import type { OpenAiCompatConfig } from './llm.config';

// OpenAI 互換 API への接続クライアント。OpenAI（本家）と LocalLLM（LM Studio 等）の
// 両方を、設定違いの 2 インスタンスで共用する。公式 openai SDK を baseURL 上書きで利用。
// 外部 SDK 呼び出しはこの infra に隔離する。レジストリが config を渡して new する。
export class OpenAiCompatibleClient implements LlmProvider {
  private cachedClient: OpenAI | undefined;
  private readonly defaultModel: string | undefined;

  constructor(private readonly config: OpenAiCompatConfig) {
    this.defaultModel = config.defaultModel;
  }

  // OpenAI クライアントは初回利用時に生成する（遅延初期化）。
  // 接続先 URL / API キー未設定時はチャット利用時のみ明確なエラーを返す。
  private get client(): OpenAI {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error(
        `LLM(${this.config.label}) の設定が不完全です。接続先 URL と API キーを確認してください。`,
      );
    }
    this.cachedClient ??= new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey,
    });
    return this.cachedClient;
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

  // 入力 model → 既定モデルの順で解決。どちらも無ければエラー。
  private resolveModel(inputModel: string | undefined): string {
    const model = inputModel ?? this.defaultModel;
    if (!model) {
      throw new Error(
        `モデルが指定されていません。入力の model か ${this.config.label} の既定モデル環境変数を設定してください。`,
      );
    }
    return model;
  }
}
