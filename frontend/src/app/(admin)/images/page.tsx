'use client';

import NextLink from 'next/link';
import { useState } from 'react';
import { Button } from '@/design-system/components/Button';
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
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-400">
          画像はまだありません。右上のボタンからアップロードしてください。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
            >
              <div className="border-b border-zinc-100 p-4">
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
              </div>
              <div className="flex justify-end gap-3 px-4 py-2 text-sm">
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
              </div>
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

  function isAllowedMime(value: string): value is ImageMimeType {
    return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
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

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-base font-semibold">画像をアップロード</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="ファイル">
          <input
            type="file"
            accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm"
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">
              {file.name} ・ {formatSize(file.size)}
            </p>
          )}
        </Field>
        <Field label="タイトル（任意）">
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="説明（任意）">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isSaving ? 'アップロード中...' : 'アップロード'}
          </Button>
        </div>
      </form>
    </Overlay>
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
    <Overlay onClose={onCancel}>
      <p className="mb-6 text-sm">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          削除する
        </Button>
      </div>
    </Overlay>
  );
}

// ---- Shared UI ----

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
