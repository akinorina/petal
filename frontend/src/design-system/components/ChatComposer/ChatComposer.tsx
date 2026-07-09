import { forwardRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import './ChatComposer.css';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** 入力行の左に並べる任意アクション（例: 画像/音声添付ボタン）。 */
  actions?: ReactNode;
  /** 入力欄の上に差し込む任意スロット（例: 添付プレビュー列）。 */
  previews?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** textarea の行数。 */
  rows?: number;
  /** 送信ボタンのラベル。 */
  submitLabel?: ReactNode;
  className?: string;
}

/**
 * チャット入力コンポーザ（自己完結）。Enter 送信 / Shift+Enter 改行 /
 * IME 変換中は送信しない / 空文字・disabled 時は送信抑止 を内包する。
 * textarea・送信ボタンは DS Input/Button と同じトークンで自前スタイルする。
 */
export const ChatComposer = forwardRef<HTMLDivElement, ChatComposerProps>(function ChatComposer(
  {
    value,
    onChange,
    onSubmit,
    actions,
    previews,
    placeholder,
    disabled = false,
    rows = 2,
    submitLabel = '送信',
    className,
  },
  ref,
) {
  const canSubmit = !disabled && value.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 送信 / Shift+Enter 改行。IME 変換中（isComposing）は送信しない。
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const rootClass = ['ds-chat-composer', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={rootClass}>
      {previews}
      <div className="ds-chat-composer__row">
        {actions}
        <textarea
          className="ds-chat-composer__textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
        />
        <button
          type="button"
          className="ds-chat-composer__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
});
