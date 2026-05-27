'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useImageDetailApi } from '@/lib/api-hooks/use-image-detail-api';

export function useImageDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const api = useImageDetailApi(id);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleDownload() {
    try {
      const url = await api.fetchDownloadUrl();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      api.setError(
        e instanceof ApiError ? e.message : 'ダウンロードに失敗しました',
      );
    }
  }

  function requestDelete() {
    setIsConfirmingDelete(true);
  }

  function cancelDelete() {
    setIsConfirmingDelete(false);
  }

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      await api.remove();
      router.push('/images');
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  }

  return {
    image: api.image,
    previewUrl: api.previewUrl,
    isLoading: api.isLoading,
    error: api.error,
    isDeleting,
    isConfirmingDelete,
    handleDownload,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
