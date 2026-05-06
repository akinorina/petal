'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  useImagesApi,
  type UploadInput,
} from '@/lib/api-hooks/use-images-api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export type Modal =
  | { type: 'upload' }
  | { type: 'delete'; image: ImageItem }
  | null;

export function useImagesPage() {
  const [modal, setModal] = useState<Modal>(null);
  const api = useImagesApi();

  async function handleDelete(image: ImageItem) {
    try {
      await api.remove(image.id);
      setModal(null);
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  async function handleUpload(input: UploadInput) {
    await api.upload(input);
    setModal(null);
  }

  return {
    images: api.images,
    isLoading: api.isLoading,
    error: api.error,
    modal,
    setModal,
    handleDelete,
    handleUpload,
  };
}
