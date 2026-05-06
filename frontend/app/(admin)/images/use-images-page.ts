'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export type Modal =
  | { type: 'upload' }
  | { type: 'delete'; image: ImageItem }
  | null;

export function useImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
      const data = await imageApi.findAll();
      setImages(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(image: ImageItem) {
    try {
      await imageApi.remove(image.id);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  async function handleUploaded() {
    setModal(null);
    await load();
  }

  return {
    images,
    isLoading,
    error,
    modal,
    setModal,
    handleDelete,
    handleUploaded,
  };
}
