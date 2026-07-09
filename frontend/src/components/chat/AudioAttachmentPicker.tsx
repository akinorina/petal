'use client';

import NextLink from 'next/link';
import { Button } from '@/design-system/components/Button';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { formatAudioSize, formatDuration } from '@/lib/audio-constants';
import type { Schemas } from '@/lib/openapi/client';
import { AudioPlayer } from './AudioPlayer';
import { MAX_AUDIO_ATTACHMENTS } from './use-audio-attachment';

type AudioItem = Schemas['AudioResponseDto'];

type AudioAttachmentPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audios: AudioItem[];
  isLoading: boolean;
  error: string | null;
  /** 選択中 id（Dialog 内のトグル状態と一致）。 */
  selectedIds: string[];
  canAddMore: boolean;
  onToggle: (id: string) => void;
};

/**
 * ライブラリ音声の選択 Dialog（画像版 `ImageAttachmentPicker` と対称）。
 * 行リストで 1 行に タイトル・再生時間・サイズ・インライン試聴・選択チェックを並べ、
 * 複数トグルして「追加」で確定する。上限（MAX_AUDIO_ATTACHMENTS）到達時は未選択分の
 * 選択を抑制し、ライブラリ 0 件時は EmptyState ＋ /audios（音声管理）への導線を表示する。
 */
export function AudioAttachmentPicker({
  open,
  onOpenChange,
  audios,
  isLoading,
  error,
  selectedIds,
  canAddMore,
  onToggle,
}: AudioAttachmentPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>音声を選択</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {isLoading ? (
            <p className="text-sm text-text-tertiary">読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-feedback-danger-default">{error}</p>
          ) : audios.length === 0 ? (
            <EmptyState
              title="音声はまだありません"
              description="先に音声管理ページで音声をアップロードしてください。"
              primaryAction={
                <NextLink href="/audios" className="ds-link ds-link--inline text-sm">
                  音声管理へ
                </NextLink>
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-text-tertiary">
                最大 {MAX_AUDIO_ATTACHMENTS} 件まで選択できます（選択済み {selectedIds.length} 件）。
              </p>
              <ul className="space-y-2">
                {audios.map((audio) => {
                  const isSelected = selectedIds.includes(audio.id);
                  // 未選択かつ上限到達時は新規選択を抑制する。
                  const isDisabled = !isSelected && !canAddMore;
                  const label = audio.title || audio.originalFilename;
                  return (
                    <li
                      key={audio.id}
                      className={[
                        'flex items-center gap-3 rounded-md border-2 p-2 transition-colors',
                        isSelected ? 'border-accent-default' : 'border-border-subtle',
                      ].join(' ')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {label}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {formatDuration(audio.durationSeconds)} ・ {formatAudioSize(audio.sizeBytes)}
                        </p>
                        <div className="mt-1">
                          <AudioPlayer audioId={audio.id} label={label} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggle(audio.id)}
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                        aria-label={`${label} を${isSelected ? '選択解除' : '選択'}`}
                        className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                          isSelected
                            ? 'border-accent-default bg-accent-default text-accent-on-accent'
                            : 'border-border-strong text-transparent',
                          isDisabled
                            ? 'cursor-not-allowed opacity-40'
                            : 'hover:border-accent-default',
                        ].join(' ')}
                      >
                        ✓
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" onClick={() => onOpenChange(false)}>
            追加（{selectedIds.length}）
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
