'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { Dialog } from '@/design-system/components/Dialog';
import { FormField } from '@/design-system/components/FormField';
import { formatImageSize } from '@/lib/image-constants';
import { useImageDetailPage } from './use-image-detail-page';

export default function ImageDetailPage() {
  const {
    image,
    previewUrl,
    isLoading,
    error,
    isDeleting,
    isConfirmingDelete,
    handleDownload,
    requestDelete,
    cancelDelete,
    confirmDelete,
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
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      </div>
    );
  }

  if (!image) return null;

  const label = image.title || image.originalFilename;

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
          <Button variant="danger" onClick={requestDelete}>
            削除
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {previewUrl && (
        <Card padding="none" className="overflow-hidden bg-zinc-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="mx-auto max-h-[70vh] w-auto object-contain"
          />
        </Card>
      )}

      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="タイトル">
            <ReadonlyText value={image.title || '—'} />
          </FormField>
          <FormField label="ファイル名">
            <ReadonlyText value={image.originalFilename} />
          </FormField>
          <FormField label="形式">
            <ReadonlyText value={image.mimeType} />
          </FormField>
          <FormField label="サイズ">
            <ReadonlyText value={formatImageSize(image.sizeBytes)} />
          </FormField>
          <FormField label="アップロード日時">
            <ReadonlyText value={formatDateTime(image.createdAt)} />
          </FormField>
          <FormField label="更新日時">
            <ReadonlyText value={formatDateTime(image.updatedAt)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="説明">
              <ReadonlyText value={image.description || '—'} multiline />
            </FormField>
          </div>
        </div>
      </Card>

      {isConfirmingDelete && (
        <Dialog open onOpenChange={(o) => !o && cancelDelete()} size="sm">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>画像を削除</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <p className="text-sm">「{label}」を削除しますか？</p>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="secondary" onClick={cancelDelete}>
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                isLoading={isDeleting}
              >
                {isDeleting ? '削除中...' : '削除する'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      )}
    </div>
  );
}

function ReadonlyText({
  value,
  multiline = false,
}: {
  value: string;
  multiline?: boolean;
}) {
  return (
    <p
      className={[
        'whitespace-pre-wrap break-words text-sm',
        multiline ? 'min-h-[3rem]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {value}
    </p>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
