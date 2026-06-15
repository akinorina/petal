import type { ChatChunk, ChatResult } from '../domain/llm-generation';
import type { LlmModel } from '../domain/llm-model';
import { type LlmProvider, type ProviderId } from '../domain/llm-provider';

// active provider が未設定のときに getActive() が返す遅延スタブ。
// 利用時に provider 固有の明確なエラーを投げ、アプリ起動自体は妨げない。
class UnconfiguredProvider implements LlmProvider {
  constructor(private readonly id: ProviderId) {}

  private error(): Error {
    return new Error(
      `LLM(${this.id}) が未設定です。${this.id} に必要な環境変数を設定するか、LLM_PROVIDER を設定済みの provider に変更してください。`,
    );
  }

  listModels(): Promise<LlmModel[]> {
    return Promise.reject(this.error());
  }

  generate(): Promise<ChatResult> {
    return Promise.reject(this.error());
  }

  // 最初の next() で必ず throw する遅延スタブ（yield しない）。
  // eslint-disable-next-line @typescript-eslint/require-await, require-yield
  async *generateStream(): AsyncGenerator<ChatChunk> {
    throw this.error();
  }
}

// 設定済みの provider を id で保持する純粋なレジストリ（application 層・infra 非依存）。
// 具象の生成は infra の buildLlmProviders が担い、ここには構築済みの Map を渡す。
// Chat は getActive() で 1 つを使うが、get(id) で任意の provider を取り出して
// 複数同時アクセス（fan-out）する用途も同じ API で satisfied。
export class LlmProviderRegistry {
  constructor(
    // 設定済み（isConfigured=true）の provider のみを保持する。
    private readonly providers: Map<ProviderId, LlmProvider>,
    private readonly activeId: ProviderId,
  ) {}

  // Chat が使う有効 provider。未設定なら遅延スタブ（利用時に明確エラー）。
  getActive(): LlmProvider {
    return (
      this.providers.get(this.activeId) ??
      new UnconfiguredProvider(this.activeId)
    );
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
