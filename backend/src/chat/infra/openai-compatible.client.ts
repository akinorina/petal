import OpenAI from 'openai';
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import {
  type ChatChunk,
  type ChatGenerationInput,
  type ChatResult,
} from '../domain/llm-generation';
import {
  contentToText,
  hasImageContent,
  type ChatContentPart,
} from '../domain/llm-message';
import { LlmModelSchema, type LlmModel } from '../domain/llm-model';
import type { LlmProvider } from '../domain/llm-provider';
import { VisionUnsupportedError } from '../domain/vision-unsupported.error';
import type { OpenAiCompatConfig } from './llm.config';

// content を OpenAI 互換の content 形式へ変換する純粋関数（判断 4）。
// 文字列は後方互換でそのまま、配列は text→{type:'text'} /
// image→{type:'image_url', image_url:{url:'data:<mediaType>;base64,<data>'}}。
export function toOpenAiContent(
  content: string | ChatContentPart[],
): string | ChatCompletionContentPart[] {
  if (typeof content === 'string') return content;
  return content.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : {
          type: 'image_url',
          image_url: { url: `data:${part.mediaType};base64,${part.data}` },
        },
  );
}

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

  supportsVision(): boolean {
    return this.config.supportsVision;
  }

  async *generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk> {
    // vision 非対応 & 画像付き content なら SDK 生成前に block（多層防御・判断 2）。
    if (!this.supportsVision() && hasImageContent(input.messages)) {
      throw new VisionUnsupportedError(this.config.label);
    }
    const model = this.resolveModel(input.model);
    const messages: ChatCompletionMessageParam[] = input.messages.map(
      (message) => {
        // user のみ画像 part を含み得る。system/assistant は画像を持てないため
        // 従来どおりテキスト化する（OpenAI 型でも image_url は user のみ・判断 5）。
        if (message.role === 'user') {
          return { role: 'user', content: toOpenAiContent(message.content) };
        }
        return { role: message.role, content: contentToText(message.content) };
      },
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
