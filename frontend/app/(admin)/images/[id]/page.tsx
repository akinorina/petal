'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];

export default function ImageDetailPage() {
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
      // 別タブで開く（ブラウザのデフォルト動作で表示 or 保存）
      window.open(dl.url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ダウンロードに失敗しました');
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

  if (isLoading) {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (error && !image) {
    return (
      <div>
        <Link href="/images" className="text-sm text-zinc-500 hover:underline">
          ← 一覧に戻る
        </Link>
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (!image) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/images" className="text-sm text-zinc-500 hover:underline">
          ← 一覧に戻る
        </Link>
        <div className="flex gap-2">
          <button onClick={handleDownload} className={secondaryBtnClass}>
            ダウンロード
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {previewUrl && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={image.title || image.originalFilename}
            className="mx-auto max-h-[60vh] w-auto"
          />
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
        <Row label="タイトル" value={image.title || '—'} />
        <Row label="ファイル名" value={image.originalFilename} />
        <Row label="形式" value={image.mimeType} />
        <Row label="サイズ" value={formatSize(image.sizeBytes)} />
        <Row
          label="アップロード日時"
          value={new Date(image.createdAt).toLocaleString('ja-JP')}
        />
        <Row
          label="更新日時"
          value={new Date(image.updatedAt).toLocaleString('ja-JP')}
        />
        <Row
          label="説明"
          value={image.description || '—'}
          className="sm:col-span-2"
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words">{value}</dd>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const secondaryBtnClass =
  'rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50';
