import { getAccessToken, refreshAccessToken } from '../auth-session';
import { BASE_URL } from '../http';
import { apiClient, unwrap, type Schemas } from './shared';

type ChatThread = Schemas['ChatThreadResponseDto'];
type ChatMessage = Schemas['ChatMessageResponseDto'];

/**
 * チャットの REST 操作（スレッド/メッセージ）。SSE 送信は `streamChatMessage` を使う。
 */
export const chatApi = {
  createThread: (body: Schemas['CreateThreadRequestDto'] = {}) =>
    unwrap(apiClient.POST('/chat/threads', { body })),
  listThreads: () => unwrap(apiClient.GET('/chat/threads')),
  listMessages: (threadId: string) =>
    unwrap(
      apiClient.GET('/chat/threads/{id}/messages', {
        params: { path: { id: threadId } },
      }),
    ),
  removeThread: async (threadId: string): Promise<void> => {
    await unwrap(
      apiClient.DELETE('/chat/threads/{id}', {
        params: { path: { id: threadId } },
      }),
    );
  },
};

export type { ChatThread, ChatMessage };

/**
 * 送信ストリームのコールバック群。`onDelta` で逐次テキスト、`onDone` で正常終了、
 * `onError` で開始前/開始後/ネットワーク例外を一貫した形（`{ code, message, retryable }`）で受ける。
 */
export type ChatStreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: (info: {
    messageId: string | null;
    seq: number | null;
    finishReason: string | null;
  }) => void;
  onError: (err: { code: string; message: string; retryable: boolean }) => void;
};

const SEND_PATH = (threadId: string) =>
  `/chat/threads/${encodeURIComponent(threadId)}/messages`;

/**
 * メッセージ送信 + SSE ストリーム受信。`apiClient`（openapi-fetch）はストリームを
 * 扱えないため生 fetch で実装する。`Authorization` ヘッダで認証し、`401` のときのみ
 * `refreshAccessToken()` で 1 度だけ再試行する（openapi の `authMiddleware` 相当）。
 */
export async function streamChatMessage(
  threadId: string,
  content: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    let token = await getAccessToken();
    if (!token) token = await refreshAccessToken();

    let res = await sendRequest(threadId, content, token, signal);

    // 401 のときのみ 1 度だけ refresh して再試行。
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await sendRequest(threadId, content, newToken, signal);
      }
    }

    if (!res.ok) {
      handlers.onError(await readPreStreamError(res));
      return;
    }

    if (!res.body) {
      handlers.onError({
        code: 'NETWORK',
        message: '通信に失敗しました',
        retryable: true,
      });
      return;
    }

    await consumeSseStream(res.body, handlers);
  } catch (err) {
    // AbortController による中断はエラーとして扱わない（unmount 時の正常中断）。
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return;
    }
    handlers.onError({
      code: 'NETWORK',
      message: '通信に失敗しました',
      retryable: true,
    });
  }
}

function sendRequest(
  threadId: string,
  content: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE_URL}${SEND_PATH(threadId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
    signal,
  });
}

/** 開始前エラー: ボディ JSON `{ code, message, retryable }`。JSON で無ければステータス由来。 */
async function readPreStreamError(res: Response): Promise<{
  code: string;
  message: string;
  retryable: boolean;
}> {
  const data = await res.json().catch(() => null);
  if (
    data &&
    typeof data === 'object' &&
    typeof (data as { code?: unknown }).code === 'string'
  ) {
    const d = data as { code: string; message?: unknown; retryable?: unknown };
    return {
      code: d.code,
      message:
        typeof d.message === 'string' ? d.message : 'エラーが発生しました',
      retryable: d.retryable === true,
    };
  }
  return {
    code: `HTTP_${res.status}`,
    message: res.statusText || 'エラーが発生しました',
    retryable: res.status >= 500,
  };
}

/** SSE フレーム（空行区切り、`event:`/`data:` 行）を読み、`data:` の JSON を `type` で分岐する。 */
async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 空行（フレーム区切り）でフレームを切り出す。CRLF/LF 双方に対応。
    let sep: number;
    while ((sep = indexOfFrameSeparator(buffer)) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep).replace(/^(?:\r?\n){2}/, '');
      handleFrame(frame, handlers);
    }
  }

  // ストリーム終端に残ったフレームを処理する。
  const tail = buffer.trim();
  if (tail) handleFrame(tail, handlers);
}

function indexOfFrameSeparator(buffer: string): number {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function handleFrame(frame: string, handlers: ChatStreamHandlers): void {
  const dataLines: string[] = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine;
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    // `event:` 行は data の JSON 内 `type` で分岐するため使わない。
  }
  if (dataLines.length === 0) return;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }
  if (!payload || typeof payload !== 'object') return;
  const event = payload as Record<string, unknown>;

  switch (event.type) {
    case 'delta':
      if (typeof event.delta === 'string') handlers.onDelta(event.delta);
      break;
    case 'done':
      handlers.onDone({
        messageId:
          typeof event.messageId === 'string' ? event.messageId : null,
        seq: typeof event.seq === 'number' ? event.seq : null,
        finishReason:
          typeof event.finishReason === 'string' ? event.finishReason : null,
      });
      break;
    case 'error':
      handlers.onError({
        code: typeof event.code === 'string' ? event.code : 'LLM_ERROR',
        message:
          typeof event.message === 'string'
            ? event.message
            : 'エラーが発生しました',
        retryable: event.retryable === true,
      });
      break;
    default:
      break;
  }
}
