'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export function useImageDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [image, setImage] = useState<ImageItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
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
    void load();
  }, [load]);

  async function handleDownload() {
    try {
      const dl = await imageApi.getDownloadUrl(id);
      window.open(dl.url, '_blank', 'noopener');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'ダウンロードに失敗しました',
      );
    }
  }

  async function handleDelete() {
    if (!confirm('この画像を削除しますか？')) return;
    setIsDeleting(true);
    try {
      await imageApi.remove(id);
      router.push('/images');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '削除に失敗しました');
      setIsDeleting(false);
    }
  }

  return {
    image,
    previewUrl,
    isLoading,
    error,
    isDeleting,
    handleDownload,
    handleDelete,
  };
}
