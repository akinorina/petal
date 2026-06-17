'use client';

import { useCallback, useMemo } from 'react';
import { audioApi, uploadToPresignedUrl } from '@/lib/api';
import { measureAudioDuration, type AudioMimeType } from '@/lib/audio-constants';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type AudioItem = Schemas['AudioResponseDto'];

export type UploadInput = {
  file: File;
  mimeType: AudioMimeType;
  title?: string;
  description?: string;
};

/**
 * 音声のダウンロード URL（署名付き URL）を命令的に取得する操作フック。
 * 一覧行のインライン再生など、一覧状態を持たずに URL だけを都度取得したい用途に使う。
 */
export function useAudioDownloadApi() {
  return useMemo(
    () => ({ getDownloadUrl: (id: string) => audioApi.getDownloadUrl(id) }),
    [],
  );
}

export function useAudiosApi() {
  const fetcher = useCallback(() => audioApi.findAll(), []);
  const { data, isLoading, error, setError, reload } =
    useApiResource<AudioItem[]>(fetcher);

  const upload = useCallback(
    async ({ file, mimeType, title, description }: UploadInput) => {
      const durationSeconds = await measureAudioDuration(file);
      const created = await audioApi.create({
        originalFilename: file.name,
        mimeType,
        sizeBytes: file.size,
        durationSeconds: durationSeconds ?? undefined,
        title: title || undefined,
        description: description || undefined,
      });
      await uploadToPresignedUrl(
        created.upload.url,
        file,
        created.upload.headers['Content-Type'],
      );
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await audioApi.remove(id);
      await reload();
    },
    [reload],
  );

  return {
    audios: data ?? [],
    isLoading,
    error,
    setError,
    reload,
    upload,
    remove,
  };
}
