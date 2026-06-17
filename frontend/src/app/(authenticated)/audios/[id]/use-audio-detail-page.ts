'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAudioDetailApi } from '@/lib/api-hooks/use-audio-detail-api';

export function useAudioDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const api = useAudioDetailApi(id);
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
      router.push('/audios');
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  }

  return {
    audio: api.audio,
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
