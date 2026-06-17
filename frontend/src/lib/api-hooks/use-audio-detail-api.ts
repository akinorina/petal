'use client';

import { useCallback } from 'react';
import { audioApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type AudioItem = Schemas['AudioResponseDto'];

export function useAudioDetailApi(id: string) {
  const fetcher = useCallback(async () => {
    const [item, dl] = await Promise.all([
      audioApi.findById(id),
      audioApi.getDownloadUrl(id),
    ]);
    return { audio: item, previewUrl: dl.url };
  }, [id]);

  const { data, isLoading, error, setError, reload } = useApiResource<{
    audio: AudioItem;
    previewUrl: string;
  }>(fetcher);

  const fetchDownloadUrl = useCallback(async () => {
    const dl = await audioApi.getDownloadUrl(id);
    return dl.url;
  }, [id]);

  const remove = useCallback(async () => {
    await audioApi.remove(id);
  }, [id]);

  return {
    audio: data?.audio ?? null,
    previewUrl: data?.previewUrl ?? null,
    isLoading,
    error,
    setError,
    reload,
    fetchDownloadUrl,
    remove,
  };
}
