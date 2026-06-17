'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  useAudiosApi,
  type UploadInput,
} from '@/lib/api-hooks/use-audios-api';
import { validateAudioFile } from '@/lib/audio-constants';
import type { Schemas } from '@/lib/openapi/client';

type AudioItem = Schemas['AudioResponseDto'];

export type Modal =
  | { type: 'upload'; initialFile?: File }
  | { type: 'delete'; audio: AudioItem }
  | null;

export const AUDIOS_PAGE_SIZE = 12;

export function useAudiosPage() {
  const [modal, setModal] = useState<Modal>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageDragOver, setIsPageDragOver] = useState(false);
  const api = useAudiosApi();

  // 再生中の <audio> を集約し、1 件再生したら他を停止する（同時再生制御）。
  const audioElements = useRef<Set<HTMLAudioElement>>(new Set());
  const registerAudio = useCallback((el: HTMLAudioElement) => {
    audioElements.current.add(el);
  }, []);
  const unregisterAudio = useCallback((el: HTMLAudioElement) => {
    audioElements.current.delete(el);
  }, []);
  const pauseOthers = useCallback((self: HTMLAudioElement) => {
    audioElements.current.forEach((el) => {
      if (el !== self) el.pause();
    });
  }, []);

  const totalPages = Math.max(
    1,
    Math.ceil(api.audios.length / AUDIOS_PAGE_SIZE),
  );

  const safePage = Math.min(currentPage, totalPages);
  const pagedAudios = useMemo(() => {
    const start = (safePage - 1) * AUDIOS_PAGE_SIZE;
    return api.audios.slice(start, start + AUDIOS_PAGE_SIZE);
  }, [api.audios, safePage]);

  async function handleDelete(audio: AudioItem) {
    try {
      await api.remove(audio.id);
      setModal(null);
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  async function handleUpload(input: UploadInput) {
    await api.upload(input);
    setModal(null);
    // 新規音声は一覧先頭に表示されるため、1 ページ目を表示
    setCurrentPage(1);
  }

  function handlePageDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    setIsPageDragOver(true);
  }

  function handlePageDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsPageDragOver(false);
  }

  function handlePageDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsPageDragOver(false);
    const list = e.dataTransfer.files;
    if (!list || list.length === 0) return;
    const result = validateAudioFile(list[0]);
    if (!result.ok) {
      api.setError(result.message);
      return;
    }
    api.setError(null);
    setModal({ type: 'upload', initialFile: result.file });
  }

  return {
    audios: api.audios,
    pagedAudios,
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    pageSize: AUDIOS_PAGE_SIZE,
    isLoading: api.isLoading,
    error: api.error,
    modal,
    setModal,
    handleDelete,
    handleUpload,
    isPageDragOver,
    handlePageDragOver,
    handlePageDragLeave,
    handlePageDrop,
    registerAudio,
    unregisterAudio,
    pauseOthers,
  };
}

function hasFiles(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes('Files');
}
