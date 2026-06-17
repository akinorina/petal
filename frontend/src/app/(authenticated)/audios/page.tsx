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
import { ApiError } from '@/lib/api';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  formatAudioSize,
  formatDuration,
  MAX_RECORDING_SECONDS,
  validateAudioFile,
} from '@/lib/audio-constants';
import {
  useAudioDownloadApi,
  type UploadInput,
} from '@/lib/api-hooks/use-audios-api';
import { useAudioRecorder } from '@/lib/use-audio-recorder';
import type { Schemas } from '@/lib/openapi/client';
import { useAudiosPage } from './use-audios-page';

type AudioItem = Schemas['AudioResponseDto'];

export default function AudiosPage() {
  const {
    audios,
    pagedAudios,
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
    registerAudio,
    unregisterAudio,
    pauseOthers,
  } = useAudiosPage();

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="relative"
    >
      <div className="mb-6 flex items-center justify-between">
        <Text as="h1" variant="heading-md">音声管理</Text>
        <Button onClick={() => setModal({ type: 'upload' })}>
          音声をアップロード
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : audios.length === 0 ? (
        <EmptyState
          title="音声はまだありません"
          description="「音声をアップロード」、またはこのページに音声ファイルをドラッグ＆ドロップで登録できます。"
          primaryAction={
            <Button onClick={() => setModal({ type: 'upload' })}>
              音声をアップロード
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {pagedAudios.map((audio) => (
              <li key={audio.id}>
                <AudioRow
                  audio={audio}
                  onDelete={() => setModal({ type: 'delete', audio })}
                  registerAudio={registerAudio}
                  unregisterAudio={unregisterAudio}
                  pauseOthers={pauseOthers}
                />
              </li>
            ))}
          </ul>

          {audios.length > pageSize && (
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
            ここに音声ファイルをドロップしてアップロード
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
          message={`「${modal.audio.title || modal.audio.originalFilename}」を削除しますか？`}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.audio)}
        />
      )}
    </div>
  );
}

// ---- AudioRow ----

function AudioRow({
  audio,
  onDelete,
  registerAudio,
  unregisterAudio,
  pauseOthers,
}: {
  audio: AudioItem;
  onDelete: () => void;
  registerAudio: (el: HTMLAudioElement) => void;
  unregisterAudio: (el: HTMLAudioElement) => void;
  pauseOthers: (self: HTMLAudioElement) => void;
}) {
  const { getDownloadUrl } = useAudioDownloadApi();
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setLoadError(false);
    getDownloadUrl(audio.id)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audio.id, reloadKey, getDownloadUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    registerAudio(el);
    return () => unregisterAudio(el);
  }, [url, registerAudio, unregisterAudio]);

  const label = audio.title || audio.originalFilename;

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <NextLink
            href={`/audios/${audio.id}`}
            className="ds-link ds-link--inline block truncate text-sm font-medium"
            title={label}
            aria-label={`${label} の詳細を開く`}
          >
            {label}
          </NextLink>
          <p className="mt-1 text-xs text-zinc-400">
            {formatDuration(audio.durationSeconds)} ・ {formatAudioSize(audio.sizeBytes)}{' '}
            ・ {formatDateTime(audio.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${label} を削除`}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          削除
        </button>
      </div>

      <div className="mt-3">
        {loadError ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>読み込みに失敗しました</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="ds-link ds-link--inline"
            >
              再読込
            </button>
          </div>
        ) : url ? (
          <audio
            ref={audioRef}
            src={url}
            controls
            preload="none"
            className="w-full"
            onPlay={(e) => pauseOthers(e.currentTarget)}
          />
        ) : (
          <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
        )}
      </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  // 録音が確定したら、既存アップロード経路に流すため file 状態へ反映する。
  useEffect(() => {
    if (recorder.recordedFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFile(recorder.recordedFile);
      setError(null);
    }
  }, [recorder.recordedFile]);

  function handleFiles(list: FileList | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const result = validateAudioFile(list[0]);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // ファイル選択時は録音プレビューを破棄し、表示と file の矛盾を防ぐ。
    recorder.reset();
    setFile(result.file);
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
    const result = validateAudioFile(file);
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
          <Dialog.Title>音声をアップロード</Dialog.Title>
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
                    accept={ALLOWED_AUDIO_MIME_TYPES.join(',')}
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {formatAudioSize(file.size)}
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
                        またはここに別の音声ファイルをドロップ
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm">
                        ここに音声ファイルをドラッグ＆ドロップ
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
                        MP3 / WAV / WebM / MP4 / OGG（20 MiB まで）
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <RecordSection recorder={recorder} />

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
            <Button
              type="submit"
              isLoading={isSaving}
              disabled={recorder.status === 'recording'}
            >
              {isSaving ? 'アップロード中...' : 'アップロード'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

// ---- RecordSection ----

function RecordSection({
  recorder,
}: {
  recorder: ReturnType<typeof useAudioRecorder>;
}) {
  const { status, isSupported, elapsedSeconds, previewUrl, error, start, stop, reset } =
    recorder;

  return (
    <div className="ds-formfield">
      <span className="ds-formfield__label">マイクで録音</span>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
        {!isSupported ? (
          <Text variant="body-sm" className="text-zinc-500">
            お使いのブラウザは録音に対応していません。
          </Text>
        ) : status === 'recording' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-red-600">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
              録音中 {formatDuration(elapsedSeconds)} / {formatDuration(MAX_RECORDING_SECONDS)}
            </div>
            <Button type="button" variant="danger" size="sm" onClick={stop}>
              停止
            </Button>
          </div>
        ) : status === 'recorded' && previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <Text variant="body-sm" className="text-zinc-600">
              録音結果
            </Text>
            <audio src={previewUrl} controls className="w-full" />
            <Button type="button" variant="secondary" size="sm" onClick={reset}>
              録り直す
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={start}>
              マイクで録音
            </Button>
            <Text variant="body-sm" className="text-zinc-500">
              最大 {MAX_RECORDING_SECONDS} 秒まで録音できます
            </Text>
          </div>
        )}
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
    </div>
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
          <Dialog.Title>音声を削除</Dialog.Title>
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
