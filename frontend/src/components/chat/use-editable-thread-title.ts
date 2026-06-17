'use client';

import { useCallback, useState } from 'react';
import { useChatActionsApi } from '@/lib/api-hooks/use-chat-api';

const UNTITLED = '無題の会話';

type UseEditableThreadTitleOptions = {
  threadId: string;
  /** 正本のタイトル（`null` は未設定）。 */
  title: string | null;
  /** 保存成功後に呼ばれる（スレッド一覧の再取得など）。 */
  onSaved?: () => void;
};

/**
 * スレッドタイトルのインライン編集状態と楽観更新を司るフック。
 * 確定時はローカル表示を即時反映し、裏で PATCH。失敗時は正本（props）へ戻し
 * `error` を設定する。`displayTitle` は常に表示用文字列（未設定は「無題の会話」）。
 */
export function useEditableThreadTitle({
  threadId,
  title,
  onSaved,
}: UseEditableThreadTitleOptions) {
  const { updateThreadTitle } = useChatActionsApi();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayTitle = (pending !== undefined ? pending : title) ?? UNTITLED;

  const startEdit = useCallback(() => {
    setDraft(title ?? '');
    setError(null);
    setIsEditing(true);
  }, [title]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const changeDraft = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = draft.trim();
    const normalized = trimmed === '' ? null : trimmed;
    setIsEditing(false);
    setError(null);
    setPending(normalized);
    setIsSaving(true);
    try {
      await updateThreadTitle(threadId, normalized);
      onSaved?.();
      setPending(undefined);
    } catch (err) {
      setPending(undefined);
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [draft, threadId, updateThreadTitle, onSaved]);

  return {
    displayTitle,
    isEditing,
    draft,
    isSaving,
    error,
    startEdit,
    submit,
    cancel,
    changeDraft,
  };
}
