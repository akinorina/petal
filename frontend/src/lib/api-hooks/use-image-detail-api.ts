'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export function useImageDetailApi(id: string) {
  const [image, setImage] = useState<ImageItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [item, dl] = await Promise.all([
        imageApi.findById(id),
        imageApi.getDownloadUrl(id),
      ]);
      setImage(item);
      setPreviewUrl(dl.url);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const fetchDownloadUrl = useCallback(async () => {
    const dl = await imageApi.getDownloadUrl(id);
    return dl.url;
  }, [id]);

  const remove = useCallback(async () => {
    await imageApi.remove(id);
  }, [id]);

  return {
    image,
    previewUrl,
    isLoading,
    error,
    setError,
    reload,
    fetchDownloadUrl,
    remove,
  };
}
