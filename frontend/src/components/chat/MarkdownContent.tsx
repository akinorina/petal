import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownContent.css';

type MarkdownContentProps = {
  /** Markdown ソーステキスト（アシスタントメッセージ本文）。 */
  content: string;
};

/**
 * アシスタントメッセージを Markdown（GFM 対応）として描画する内部部品。
 * `components/chat/` 配下の非公開実装（barrel からは export しない）。
 * 生 HTML は描画しない（react-markdown のデフォルト挙動を維持）。
 */
const markdownComponents: Components = {
  // リンクは新規タブで開く（チャット文脈を失わないため）。
  a: ({ node, ...props }) => {
    // `node`（hast ノード）は DOM 属性ではないため <a> へ展開しない。
    void node;
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
