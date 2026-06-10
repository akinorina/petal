'use client';

import { useCallback } from 'react';
import { imageApi, uploadToPresignedUrl } from '@/lib/api';
import type { ImageMimeType } from '@/lib/image-constants';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type ImageItem = Schemas['ImageResponseDto'];

export type UploadInput = {
  file: File;
  mimeType: ImageMimeType;
  title?: string;
  description?: string;
};

export function useImagesApi() {
  const fetcher = useCallback(() => imageApi.findAll(), []);
  const { data, isLoading, error, setError, reload } =
    useApiResource<ImageItem[]>(fetcher);

  const upload = useCallback(
    async ({ file, mimeType, title, description }: UploadInput) => {
      const created = await imageApi.create({
        originalFilename: file.name,
        mimeType,
        sizeBytes: file.size,
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
      await imageApi.remove(id);
      await reload();
    },
    [reload],
  );

  return {
    images: data ?? [],
    isLoading,
    error,
    setError,
    reload,
    upload,
    remove,
  };
}
