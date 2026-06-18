import { type Content, GoogleGenAI, type Part } from '@google/genai';
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
import type { GeminiConfig } from './llm.config';

// content を Gemini の Part 配列へ変換する純粋関数（判断 4）。
// 文字列は単一 text part、配列は text→{text} / image→{inlineData:{mimeType,data}}。
export function toGeminiParts(content: string | ChatContentPart[]): Part[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.map((part) =>
    part.type === 'text'
      ? { text: part.text }
      : { inlineData: { mimeType: part.mediaType, data: part.data } },
  );
}

// Gemini（@google/genai）への接続クライアント。
// 外部 SDK 呼び出しはこの infra に隔離する。レジストリが config を渡して new する。
export class GeminiClient implements LlmProvider {
  private cachedClient: GoogleGenAI | undefined;
  private readonly defaultModel: string | undefined;

  constructor(private readonly config: GeminiConfig) {
    this.defaultModel = config.defaultModel;
  }

  // 遅延初期化。API キー未設定時はチャット利用時のみ明確なエラーを返す。
  private get client(): GoogleGenAI {
    if (!this.config.apiKey) {
      throw new Error(
        'LLM(Gemini) が未設定です。環境変数 GEMINI_API_KEY を設定してください。',
      );
    }
    this.cachedClient ??= new GoogleGenAI({ apiKey: this.config.apiKey });
    return this.cachedClient;
  }

  async listModels(): Promise<LlmModel[]> {
    const models: LlmModel[] = [];
    const pager = await this.client.models.list();
    for await (const model of pager) {
      // 'models/gemini-...' の接頭辞を除いた id を採用。
      const name = model.name ?? '';
      const id = name.startsWith('models/')
        ? name.slice('models/'.length)
        : name;
      if (id.length > 0) {
        models.push(LlmModelSchema.parse({ id, ownedBy: null }));
      }
    }
    return models;
  }

  supportsVision(): boolean {
    return true;
  }

  async *generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk> {
    // vision 非対応 & 画像付き content なら SDK 生成前に block（多層防御・判断 2）。
    if (!this.supportsVision() && hasImageContent(input.messages)) {
      throw new VisionUnsupportedError('Gemini');
    }
    const model = this.resolveModel(input.model);
    const { systemInstruction, contents } = this.mapMessages(input.messages);

    const stream = await this.client.models.generateContentStream({
      model,
      contents,
      ...(systemInstruction === undefined
        ? {}
        : { config: { systemInstruction } }),
    });

    let finishReason: string | null = null;
    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta !== undefined && delta.length > 0) {
        yield { delta, done: false };
      }
      const reason = chunk.candidates?.[0]?.finishReason;
      if (reason !== undefined) {
        finishReason = String(reason);
      }
    }

    yield { delta: '', done: true, finishReason, model };
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

  // system ロールは systemInstruction へ分離、user→'user' / assistant→'model'。
  private mapMessages(messages: ChatGenerationInput['messages']): {
    systemInstruction: string | undefined;
    contents: Content[];
  } {
    const systemParts: string[] = [];
    const contents: Content[] = [];
    for (const message of messages) {
      // system は画像を持てないため従来どおりテキスト化（判断 5）。
      if (message.role === 'system') {
        systemParts.push(contentToText(message.content));
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: toGeminiParts(message.content),
        });
      }
    }
    return {
      systemInstruction:
        systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      contents,
    };
  }

  // 入力 model → GEMINI_MODEL の順で解決。どちらも無ければエラー。
  private resolveModel(inputModel: string | undefined): string {
    const model = inputModel ?? this.defaultModel;
    if (!model) {
      throw new Error(
        'モデルが指定されていません。入力の model か環境変数 GEMINI_MODEL を設定してください。',
      );
    }
    return model;
  }
}
