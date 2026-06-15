import { Injectable } from '@nestjs/common';
import type {
  ChatChunk,
  ChatGenerationInput,
  ChatResult,
} from '../domain/llm-generation';
import type { LlmModel } from '../domain/llm-model';
import { type LlmProvider, type ProviderId } from '../domain/llm-provider';
import { ClaudeClient } from '../infra/claude.client';
import { GeminiClient } from '../infra/gemini.client';
import { LlmConfig } from '../infra/llm.config';
import { OpenAiCompatibleClient } from '../infra/openai-compatible.client';

const ALL_PROVIDER_IDS: readonly ProviderId[] = [
  'claude',
  'gemini',
  'openai',
  'local',
];

// active provider が未設定のときに getActive() が返す遅延スタブ。
// 利用時に provider 固有の明確なエラーを投げ、アプリ起動自体は妨げない。
class UnconfiguredProvider implements LlmProvider {
  constructor(private readonly id: ProviderId) {}

  private fail(): never {
    throw new Error(
      `LLM(${this.id}) が未設定です。${this.id} に必要な環境変数を設定するか、LLM_PROVIDER を設定済みの provider に変更してください。`,
    );
  }

  listModels(): Promise<LlmModel[]> {
    return this.fail();
  }

  generate(): Promise<ChatResult> {
    return this.fail();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *generateStream(): AsyncGenerator<ChatChunk> {
    this.fail();
  }
}

// 設定済みの全 provider を id で保持するレジストリ。
// Chat は getActive() で 1 つを使うが、get(id) で任意の provider を取り出して
// 複数同時アクセス（fan-out）する用途も同じ API で satisfied。
@Injectable()
export class LlmProviderRegistry {
  // 設定済み（isConfigured=true）の provider のみを保持する。
  private readonly providers = new Map<ProviderId, LlmProvider>();
  private readonly activeId: ProviderId;

  constructor(config: LlmConfig) {
    this.activeId = config.activeProviderId;
    for (const id of ALL_PROVIDER_IDS) {
      if (config.isConfigured(id)) {
        this.providers.set(id, LlmProviderRegistry.build(id, config));
      }
    }
  }

  private static build(id: ProviderId, config: LlmConfig): LlmProvider {
    switch (id) {
      case 'claude':
        return new ClaudeClient(config.claudeConfig);
      case 'gemini':
        return new GeminiClient(config.geminiConfig);
      case 'openai':
        return new OpenAiCompatibleClient(config.openaiConfig);
      case 'local':
        return new OpenAiCompatibleClient(config.localConfig);
    }
  }

  // Chat が使う有効 provider。未設定なら遅延スタブ（利用時に明確エラー）。
  getActive(): LlmProvider {
    return this.providers.get(this.activeId) ?? new UnconfiguredProvider(this.activeId);
  }

  // 任意の provider を取り出す。未設定の id は明確なエラー。
  get(id: ProviderId): LlmProvider {
    const provider = this.providers.get(id);
    if (provider === undefined) {
      throw new Error(`LLM provider '${id}' は設定されていません。`);
    }
    return provider;
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  // 設定済み provider の id 一覧（fan-out の起点）。
  availableIds(): ProviderId[] {
    return [...this.providers.keys()];
  }
}
