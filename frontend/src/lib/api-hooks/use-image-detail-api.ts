'use client';

import { useCallback } from 'react';
import { imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type ImageItem = Schemas['ImageResponseDto'];

export function useImageDetailApi(id: string) {
  const fetcher = useCallback(async () => {
    const [item, dl] = await Promise.all([
      imageApi.findById(id),
      imageApi.getDownloadUrl(id),
    ]);
    return { image: item, previewUrl: dl.url };
  }, [id]);

  const { data, isLoading, error, setError, reload } = useApiResource<{
    image: ImageItem;
    previewUrl: string;
  }>(fetcher);

  const fetchDownloadUrl = useCallback(async () => {
    const dl = await imageApi.getDownloadUrl(id);
    return dl.url;
  }, [id]);

  const remove = useCallback(async () => {
    await imageApi.remove(id);
  }, [id]);

  return {
    image: data?.image ?? null,
    previewUrl: data?.previewUrl ?? null,
    isLoading,
    error,
    setError,
    reload,
    fetchDownloadUrl,
    remove,
  };
}
