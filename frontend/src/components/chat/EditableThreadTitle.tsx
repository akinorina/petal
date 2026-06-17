'use client';

import type { KeyboardEvent } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { useEditableThreadTitle } from './use-editable-thread-title';

export type EditableThreadTitleProps = {
  threadId: string;
  /** 正本のタイトル（`null` は未設定）。 */
  title: string | null;
  /** スレッド一覧の取得中はプレースホルダ表示にする。 */
  isLoading?: boolean;
  /** 保存成功後に呼ばれる（一覧再取得など）。 */
  onSaved?: () => void | Promise<void>;
};

/**
 * スレッド詳細ヘッダのタイトル。タップ（または「編集」ボタン）で `Input` 化し、
 * 完了/Enter で確定（楽観更新）、キャンセル/Esc で編集前へ戻す。
 */
export function EditableThreadTitle({
  threadId,
  title,
  isLoading = false,
  onSaved,
}: EditableThreadTitleProps) {
  const {
    displayTitle,
    isEditing,
    draft,
    isSaving,
    error,
    startEdit,
    submit,
    cancel,
    changeDraft,
  } = useEditableThreadTitle({ threadId, title, onSaved });

  if (isLoading) {
    return (
      <Text as="h1" variant="heading-md" className="flex-none">
        {' '}
      </Text>
    );
  }

  if (isEditing) {
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };

    return (
      <div className="flex flex-none items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => changeDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={255}
          autoFocus
          aria-label="スレッドのタイトル"
        />
        <Button onClick={() => void submit()} disabled={isSaving}>
          完了
        </Button>
        <Button variant="secondary" onClick={cancel} disabled={isSaving}>
          キャンセル
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-none flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={startEdit}
          className="text-left"
          aria-label="タイトルを編集"
        >
          <Text as="h1" variant="heading-md">
            {displayTitle}
          </Text>
        </button>
        <Button variant="link" size="sm" onClick={startEdit}>
          編集
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
