'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAudiosApi } from '@/lib/api-hooks/use-audios-api';
import type { Schemas } from '@/lib/openapi/client';

type AudioItem = Schemas['AudioResponseDto'];

/** 添付できる音声の上限（バック TSK-131 と同値）。 */
export const MAX_AUDIO_ATTACHMENTS = 3;

/**
 * 音声添付の選択 state と副作用を担う同居フック（画像版 `useImageAttachment` と対称）。
 * 選択中 id・ライブラリ一覧（`useAudiosApi`）・Dialog 開閉・add/remove/toggle/clear・
 * 上限制御を集約し、`ChatConversation`（View）はこれを使うだけにする。
 */
export function useAudioAttachment() {
  const { audios, isLoading, error, reload } = useAudiosApi();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  // 選択中 id を選択順のまま音声メタへ解決する（position はこの順序で付与される）。
  const selectedAudios = useMemo<AudioItem[]>(() => {
    const byId = new Map(audios.map((a) => [a.id, a]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((a): a is AudioItem => a !== undefined);
  }, [audios, selectedIds]);

  const canAddMore = selectedIds.length < MAX_AUDIO_ATTACHMENTS;

  // Dialog 内の複数トグル。未選択かつ上限到達時は追加を抑制する。
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_AUDIO_ATTACHMENTS) return prev;
      return [...prev, id];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  return {
    selectedIds,
    selectedAudios,
    audios,
    isLoading,
    error,
    reload,
    isPickerOpen,
    openPicker,
    closePicker,
    toggle,
    remove,
    clear,
    canAddMore,
  };
}
