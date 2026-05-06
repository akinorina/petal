'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi, uploadToPresignedUrl } from '@/lib/api';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  type ImageMimeType,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/image-constants';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

type Modal =
  | { type: 'upload' }
  | { type: 'delete'; image: ImageItem }
  | null;

export default function ImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
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
    void load();
  }, [load]);

  async function handleDelete(image: ImageItem) {
    try {
      await imageApi.remove(image.id);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">画像管理</h1>
        <button
          onClick={() => setModal({ type: 'upload' })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          画像をアップロード
        </button>
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
                <Link
                  href={`/images/${image.id}`}
                  className="block text-sm font-medium hover:underline"
                >
                  {image.title || image.originalFilename}
                </Link>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {image.originalFilename}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatSize(image.sizeBytes)} ・{' '}
                  {new Date(image.createdAt).toLocaleString('ja-JP')}
                </p>
              </div>
              <div className="flex justify-end gap-3 px-4 py-2 text-sm">
                <Link
                  href={`/images/${image.id}`}
                  className="text-zinc-500 hover:text-zinc-900"
                >
                  詳細
                </Link>
                <button
                  onClick={() => setModal({ type: 'delete', image })}
                  className="text-red-400 hover:text-red-600"
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
          onUploaded={async () => {
            setModal(null);
            await load();
          }}
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
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => Promise<void>;
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
      const created = await imageApi.create({
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        title: title || undefined,
        description: description || undefined,
      });
      await uploadToPresignedUrl(
        created.upload.url,
        file,
        created.upload.headers['Content-Type'],
      );
      await onUploaded();
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="説明（任意）">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            キャンセル
          </button>
          <button type="submit" disabled={isSaving} className={primaryBtnClass}>
            {isSaving ? 'アップロード中...' : 'アップロード'}
          </button>
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
        <button onClick={onCancel} className={secondaryBtnClass}>
          キャンセル
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          削除する
        </button>
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

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';
const primaryBtnClass =
  'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50';
const secondaryBtnClass =
  'rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50';
