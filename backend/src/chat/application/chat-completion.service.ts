import { HttpException, Injectable } from '@nestjs/common';
import type { User } from '../../user/domain/user';
import type { ChatMessage } from '../domain/chat-message';
import { classifyLlmError } from './chat-error';
import type { SendMessageInput } from './chat.schemas';
import type { ChatStreamEvent } from './chat-stream';
import { ChatService } from './chat.service';
import { ChatThreadService } from './chat-thread.service';

// 送信フローの結合（オーケストレーション）。
// ユーザーメッセージ保存 → 履歴ロード → LLM ストリーム → 逐次転送 →
// 完了/中断時にアシスタントメッセージ保存。
@Injectable()
export class ChatCompletionService {
  constructor(
    private readonly threadService: ChatThreadService,
    private readonly chatService: ChatService,
  ) {}

  async *streamCompletion(
    currentUser: User,
    threadId: string,
    input: SendMessageInput,
  ): AsyncGenerator<ChatStreamEvent> {
    // try の前に呼ぶ。非所有なら NotFoundException がそのまま伝播する（認可委譲）。
    await this.threadService.addMessage(currentUser, threadId, {
      role: 'user',
      content: input.content,
    });
    const history = await this.threadService.findMessages(
      currentUser,
      threadId,
    );
    const messages = history.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    let accumulated = '';
    let started = false;
    let finishReason: string | null = null;
    const state: { persisted: boolean; saved: ChatMessage | null } = {
      persisted: false,
      saved: null,
    };

    const persist = async (): Promise<void> => {
      if (state.persisted) return;
      state.persisted = true;
      if (accumulated.length === 0) return;
      state.saved = await this.threadService.addMessage(
        currentUser,
        threadId,
        { role: 'assistant', content: accumulated },
      );
    };

    try {
      for await (const chunk of this.chatService.generateStream({ messages })) {
        if (chunk.done) {
          finishReason = chunk.finishReason ?? null;
          break;
        }
        if (chunk.delta) {
          accumulated += chunk.delta;
          started = true;
          yield { type: 'delta', delta: chunk.delta };
        }
      }
      await persist();
      yield {
        type: 'done',
        messageId: state.saved?.id ?? null,
        seq: state.saved?.seq ?? null,
        finishReason,
      };
    } catch (err) {
      if (!started) {
        // ストリーム開始前エラー → HTTP 化して controller の例外フィルタに委ねる。
        const classified = classifyLlmError(err);
        throw new HttpException(
          {
            code: classified.code,
            message: classified.message,
            retryable: classified.retryable,
          },
          classified.httpStatus,
        );
      }
      // ストリーム開始後エラー → 部分保存して error イベントを流す。
      await persist();
      const classified = classifyLlmError(err);
      yield {
        type: 'error',
        code: classified.code,
        message: classified.message,
        retryable: classified.retryable,
      };
    } finally {
      // 切断時（gen.return() で finally が走る）の部分保存。二重ガードで no-op になり得る。
      await persist();
    }
  }
}
