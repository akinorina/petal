'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { Dialog } from '@/design-system/components/Dialog';
import { FormField } from '@/design-system/components/FormField';
import { formatAudioSize, formatDuration } from '@/lib/audio-constants';
import { useAudioDetailPage } from './use-audio-detail-page';

export default function AudioDetailPage() {
  const {
    audio,
    previewUrl,
    isLoading,
    error,
    isDeleting,
    isConfirmingDelete,
    handleDownload,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useAudioDetailPage();

  if (isLoading) {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (error && !audio) {
    return (
      <div>
        <NextLink href="/audios" className="ds-link ds-link--inline text-sm">
          ← 一覧に戻る
        </NextLink>
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      </div>
    );
  }

  if (!audio) return null;

  const label = audio.title || audio.originalFilename;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <NextLink href="/audios" className="ds-link ds-link--inline text-sm">
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
        <Card padding="md" className="bg-zinc-50">
          <audio src={previewUrl} controls preload="none" className="w-full" />
        </Card>
      )}

      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="タイトル">
            <ReadonlyText value={audio.title || '—'} />
          </FormField>
          <FormField label="ファイル名">
            <ReadonlyText value={audio.originalFilename} />
          </FormField>
          <FormField label="形式">
            <ReadonlyText value={audio.mimeType} />
          </FormField>
          <FormField label="サイズ">
            <ReadonlyText value={formatAudioSize(audio.sizeBytes)} />
          </FormField>
          <FormField label="再生時間">
            <ReadonlyText value={formatDuration(audio.durationSeconds)} />
          </FormField>
          <FormField label="アップロード日時">
            <ReadonlyText value={formatDateTime(audio.createdAt)} />
          </FormField>
          <FormField label="更新日時">
            <ReadonlyText value={formatDateTime(audio.updatedAt)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="説明">
              <ReadonlyText value={audio.description || '—'} multiline />
            </FormField>
          </div>
        </div>
      </Card>

      {isConfirmingDelete && (
        <Dialog open onOpenChange={(o) => !o && cancelDelete()} size="sm">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>音声を削除</Dialog.Title>
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
