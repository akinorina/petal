'use client';

import NextLink from 'next/link';
import { Button } from '@/design-system/components/Button/Button';
import { useImageDetailPage } from './use-image-detail-page';

export default function ImageDetailPage() {
  const {
    image,
    previewUrl,
    isLoading,
    error,
    isDeleting,
    handleDownload,
    handleDelete,
  } = useImageDetailPage();

  if (isLoading) {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (error && !image) {
    return (
      <div>
        <NextLink href="/images" className="ds-link ds-link--inline text-sm">
          ← 一覧に戻る
        </NextLink>
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
        <NextLink href="/images" className="ds-link ds-link--inline text-sm">
          ← 一覧に戻る
        </NextLink>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownload}>
            ダウンロード
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
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
