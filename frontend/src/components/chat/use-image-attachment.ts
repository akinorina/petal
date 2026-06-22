'use client';

import { useCallback, useMemo, useState } from 'react';
import { useImagesApi } from '@/lib/api-hooks/use-images-api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

/** 添付できる画像の上限（バック TSK-124 と同値）。 */
export const MAX_ATTACHMENTS = 5;

/**
 * 画像添付の選択 state と副作用を担う同居フック（D4）。
 * 選択中 id・ライブラリ一覧（`useImagesApi`）・Dialog 開閉・add/remove/toggle/clear・
 * 上限制御を集約し、`ChatConversation`（View）はこれを使うだけにする。
 */
export function useImageAttachment() {
  const { images, isLoading, error, reload } = useImagesApi();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  // 選択中 id を選択順のまま画像メタへ解決する（position はこの順序で付与される）。
  const selectedImages = useMemo<ImageItem[]>(() => {
    const byId = new Map(images.map((img) => [img.id, img]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((img): img is ImageItem => img !== undefined);
  }, [images, selectedIds]);

  const canAddMore = selectedIds.length < MAX_ATTACHMENTS;

  // Dialog 内の複数トグル。未選択かつ上限到達時は追加を抑制する。
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [...prev, id];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  return {
    selectedIds,
    selectedImages,
    images,
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
