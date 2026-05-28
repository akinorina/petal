'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi, uploadToPresignedUrl } from '@/lib/api';
import type { ImageMimeType } from '@/lib/image-constants';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export type UploadInput = {
  file: File;
  mimeType: ImageMimeType;
  title?: string;
  description?: string;
};

export function useImagesApi() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

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
    images,
    isLoading,
    error,
    setError,
    reload,
    upload,
    remove,
  };
}
