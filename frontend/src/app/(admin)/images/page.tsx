'use client';

import NextLink from 'next/link';
import { useRef, useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { FormField } from '@/design-system/components/FormField';
import { Input, Textarea } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  type ImageMimeType,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/image-constants';
import type { UploadInput } from '@/lib/api-hooks/use-images-api';
import { useImagesPage } from './use-images-page';

export default function ImagesPage() {
  const {
    images,
    isLoading,
    error,
    modal,
    setModal,
    handleDelete,
    handleUpload,
  } = useImagesPage();

  return (
    <div>
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
          description="右上の「画像をアップロード」から最初の画像を登録しましょう。"
          primaryAction={
            <Button onClick={() => setModal({ type: 'upload' })}>
              画像をアップロード
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li key={image.id}>
              <Card padding="none">
                <Card.Body className="border-b border-zinc-100 p-4">
                  <NextLink
                    href={`/images/${image.id}`}
                    className="block text-sm font-medium hover:underline"
                  >
                    {image.title || image.originalFilename}
                  </NextLink>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {image.originalFilename}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatSize(image.sizeBytes)} ・{' '}
                    {new Date(image.createdAt).toLocaleString('ja-JP')}
                  </p>
                </Card.Body>
                <Card.Footer className="flex justify-end gap-3 px-4 py-2 text-sm">
                  <NextLink
                    href={`/images/${image.id}`}
                    className="ds-link ds-link--inline"
                  >
                    詳細
                  </NextLink>
                  <button
                    onClick={() => setModal({ type: 'delete', image })}
                    className="ds-link ds-link--inline text-red-500"
                  >
                    削除
                  </button>
                </Card.Footer>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {modal?.type === 'upload' && (
        <UploadModal
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

// ---- UploadModal ----

function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (input: UploadInput) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function isAllowedMime(value: string): value is ImageMimeType {
    return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
  }

  function handleFiles(list: FileList | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const picked = list[0];
    if (!isAllowedMime(picked.type)) {
      setError(
        `対応していないファイル形式です: ${picked.type || '不明'}（JPEG/PNG/GIF/WebP のみ）`,
      );
      return;
    }
    if (picked.size > MAX_IMAGE_SIZE_BYTES) {
      setError(
        `ファイルサイズが上限 (${formatSize(MAX_IMAGE_SIZE_BYTES)}) を超えています`,
      );
      return;
    }
    setFile(picked);
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
    handleFiles(e.dataTransfer.files);
  }

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }
    if (!isAllowedMime(file.type)) {
      setError(
        `対応していないファイル形式です: ${file.type || '不明'}（JPEG/PNG/GIF/WebP のみ）`,
      );
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(
        `ファイルサイズが上限 (${formatSize(MAX_IMAGE_SIZE_BYTES)}) を超えています`,
      );
      return;
    }

    setIsSaving(true);
    try {
      await onUpload({ file, mimeType: file.type, title, description });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
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
              <FormField label="ファイル" isRequired>
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
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {formatSize(file.size)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={openFileDialog}
                      >
                        ファイルを変更
                      </Button>
                      <p className="text-xs text-zinc-400">
                        またはここに別の画像をドロップ
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm">
                        ここに画像をドラッグ＆ドロップ
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={openFileDialog}
                      >
                        ファイルを選択
                      </Button>
                      <p className="text-xs text-zinc-500">
                        JPEG / PNG / GIF / WebP（10 MiB まで）
                      </p>
                    </div>
                  )}
                </div>
              </FormField>
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
