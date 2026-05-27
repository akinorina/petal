'use client';

import { useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  useImagesApi,
  type UploadInput,
} from '@/lib/api-hooks/use-images-api';
import { validateImageFile } from '@/lib/image-constants';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export type Modal =
  | { type: 'upload'; initialFile?: File }
  | { type: 'delete'; image: ImageItem }
  | null;

export const IMAGES_PAGE_SIZE = 12;

export function useImagesPage() {
  const [modal, setModal] = useState<Modal>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageDragOver, setIsPageDragOver] = useState(false);
  const api = useImagesApi();

  const totalPages = Math.max(
    1,
    Math.ceil(api.images.length / IMAGES_PAGE_SIZE),
  );

  const safePage = Math.min(currentPage, totalPages);
  const pagedImages = useMemo(() => {
    const start = (safePage - 1) * IMAGES_PAGE_SIZE;
    return api.images.slice(start, start + IMAGES_PAGE_SIZE);
  }, [api.images, safePage]);

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
    // 新規画像は配列末尾に追加されるため、最終ページへ遷移
    const nextTotalPages = Math.max(
      1,
      Math.ceil((api.images.length + 1) / IMAGES_PAGE_SIZE),
    );
    setCurrentPage(nextTotalPages);
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
    const result = validateImageFile(list[0]);
    if (!result.ok) {
      api.setError(result.message);
      return;
    }
    api.setError(null);
    setModal({ type: 'upload', initialFile: result.file });
  }

  return {
    images: api.images,
    pagedImages,
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    pageSize: IMAGES_PAGE_SIZE,
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
  };
}

function hasFiles(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes('Files');
}
