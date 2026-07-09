import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import './ChatBubble.css';

export type ChatBubbleVariant = 'sent' | 'received';

export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** sent=自分の発言（右寄せ・accent チント）/ received=相手の発言（左寄せ・ニュートラル面）。 */
  variant: ChatBubbleVariant;
  children?: ReactNode;
}

/**
 * 会話バブル（純表示）。`variant` で配置（右/左）と配色（accent チント / ニュートラル面）を
 * 同時に決める。本文・添付・pending 表示などは children として渡す。
 */
export const ChatBubble = forwardRef<HTMLDivElement, ChatBubbleProps>(function ChatBubble(
  { variant, className, children, ...rest },
  ref,
) {
  const rootClass = ['ds-chat-bubble', `ds-chat-bubble--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={rootClass} {...rest}>
      <div className="ds-chat-bubble__body">{children}</div>
    </div>
  );
});
