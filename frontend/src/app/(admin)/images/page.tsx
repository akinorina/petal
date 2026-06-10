'use client';

import NextLink from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { FormField } from '@/design-system/components/FormField';
import { Input, Textarea } from '@/design-system/components/Input';
import { Pagination } from '@/design-system/components/Pagination';
import { Text } from '@/design-system/components/Text';
import { ApiError, imageApi } from '@/lib/api';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  formatImageSize,
  validateImageFile,
} from '@/lib/image-constants';
import { processImageFile } from '@/lib/image-process';
import type { UploadInput } from '@/lib/api-hooks/use-images-api';
import type { Schemas } from '@/lib/openapi/client';
import { useImagesPage } from './use-images-page';

type ImageItem = Schemas['ImageResponseDto'];

export default function ImagesPage() {
  const {
    images,
    pagedImages,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    isLoading,
    error,
    modal,
    setModal,
    handleDelete,
    handleUpload,
    isPageDragOver,
    handlePageDragOver,
    handlePageDragLeave,
    handlePageDrop,
  } = useImagesPage();

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="relative"
    >
      <div className="mb-6 flex items-center justify-between">
        <Text as="h1" variant="heading-md">画像管理</Text>
        <Button onClick={() => setModal({ type: 'upload' })}>
          画像をアップロード
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : images.length === 0 ? (
        <EmptyState
          title="画像はまだありません"
          description="「画像をアップロード」、またはこのページに画像をドラッグ＆ドロップで登録できます。"
          primaryAction={
            <Button onClick={() => setModal({ type: 'upload' })}>
              画像をアップロード
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
            {pagedImages.map((image) => (
              <li key={image.id}>
                <ImageThumbnail
                  image={image}
                  onDelete={() => setModal({ type: 'delete', image })}
                />
              </li>
            ))}
          </ul>

          {images.length > pageSize && (
            <div className="mt-6 flex justify-center">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {isPageDragOver && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-blue-400 bg-white/90 px-6 py-4 text-sm font-medium text-blue-700 shadow">
            ここに画像をドロップしてアップロード
          </div>
        </div>
      )}

      {modal?.type === 'upload' && (
        <UploadModal
          initialFile={modal.initialFile}
          onClose={() => setModal(null)}
          onUpload={handleUpload}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          message={`「${modal.image.title || modal.image.originalFilename}」を削除しますか？`}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.image)}
        />
      )}
    </div>
  );
}

// ---- ImageThumbnail ----

function ImageThumbnail({
  image,
  onDelete,
}: {
  image: ImageItem;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setLoadError(false);
    imageApi
      .getDownloadUrl(image.id)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image.id, reloadKey]);

  const label = image.title || image.originalFilename;

  return (
    <div className="group relative overflow-hidden rounded-md border border-zinc-200 bg-white">
      <NextLink
        href={`/images/${image.id}`}
        className="block"
        aria-label={`${label} の詳細を開く`}
      >
        <div className="relative aspect-square bg-zinc-100">
          {loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-zinc-500">
              <span>読み込みに失敗しました</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setReloadKey((k) => k + 1);
                }}
                className="ds-link ds-link--inline"
              >
                再読込
              </button>
            </div>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="h-full w-full object-cover"
              onError={() => setLoadError(true)}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-zinc-200" />
          )}
        </div>
        <div className="border-t border-zinc-100 px-3 py-2">
          <p className="line-clamp-2 text-sm font-medium" title={label}>
            {label}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatImageSize(image.sizeBytes)}
          </p>
        </div>
      </NextLink>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`${label} を削除`}
        className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-red-600 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100 focus:opacity-100"
      >
        削除
      </button>
    </div>
  );
}

// ---- UploadModal ----

function UploadModal({
  initialFile,
  onClose,
  onUpload,
}: {
  initialFile?: File;
  onClose: () => void;
  onUpload: (input: UploadInput) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesWithProcess(list: FileList | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const pre = validateImageFile(list[0]);
    if (!pre.ok) {
      setError(pre.message);
      return;
    }
    setIsProcessing(true);
    try {
      const processed = await processImageFile(pre.file);
      const post = validateImageFile(processed);
      if (!post.ok) {
        setError(post.message);
        return;
      }
      setFile(post.file);
    } catch {
      setError('画像の処理に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    void handleFilesWithProcess(e.dataTransfer.files);
  }

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function openCameraDialog() {
    cameraInputRef.current?.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }
    const result = validateImageFile(file);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setIsSaving(true);
    try {
      await onUpload({
        file: result.file,
        mimeType: result.mimeType,
        title,
        description,
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'アップロードに失敗しました',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const dropZoneClass = [
    'flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
    isDragOver
      ? 'border-blue-400 bg-blue-50'
      : file
        ? 'border-zinc-400 bg-zinc-50'
        : 'border-zinc-300',
  ].join(' ');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>画像をアップロード</Dialog.Title>
        </Dialog.Header>
        <form onSubmit={handleSubmit}>
          <Dialog.Body>
            <div className="space-y-4">
              <div className="ds-formfield">
                <span className="ds-formfield__label">
                  ファイル
                  <span className="ds-formfield__required" aria-hidden="true">
                    *
                  </span>
                </span>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={dropZoneClass}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
                    onChange={(e) => void handleFilesWithProcess(e.target.files)}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleFilesWithProcess(e.target.files)}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {formatImageSize(file.size)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={openFileDialog}
                          isLoading={isProcessing}
                        >
                          ファイルを変更
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={openCameraDialog}
                          isLoading={isProcessing}
                        >
                          カメラで再撮影
                        </Button>
                      </div>
                      <p className="text-xs text-zinc-400">
                        またはここに別の画像をドロップ
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm">
                        ここに画像をドラッグ＆ドロップ
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={openFileDialog}
                          isLoading={isProcessing}
                        >
                          ファイルを選択
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={openCameraDialog}
                          isLoading={isProcessing}
                        >
                          カメラで撮影
                        </Button>
                      </div>
                      <p className="text-xs text-zinc-500">
                        JPEG / PNG / GIF / WebP（10 MiB まで）
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <FormField label="タイトル（任意）">
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormField>
              <FormField label="説明（任意）">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </FormField>

              {error && <Alert variant="danger">{error}</Alert>}
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? 'アップロード中...' : 'アップロード'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

// ---- ConfirmModal ----

function ConfirmModal({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} size="sm">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>画像を削除</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-sm">{message}</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            削除する
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
