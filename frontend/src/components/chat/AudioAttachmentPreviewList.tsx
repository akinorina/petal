'use client';

import { formatDuration } from '@/lib/audio-constants';
import type { Schemas } from '@/lib/openapi/client';

type AudioItem = Schemas['AudioResponseDto'];

type AudioAttachmentPreviewListProps = {
  /** 選択中の音声（選択順）。 */
  audios: AudioItem[];
  /** 「×」で個別取り消し。 */
  onRemove: (id: string) => void;
  /** 送信中は取り消しを無効化する。 */
  disabled?: boolean;
};

/**
 * 入力欄上の選択中音声列（画像版 `AttachmentPreviewList` と対称）。
 * 各行に タイトル＋再生時間と「×」個別取り消しを並べる。選択が無いときは何も描画しない。
 */
export function AudioAttachmentPreviewList({
  audios,
  onRemove,
  disabled = false,
}: AudioAttachmentPreviewListProps) {
  if (audios.length === 0) return null;

  return (
    <ul className="mb-2 space-y-1">
      {audios.map((audio) => {
        const label = audio.title || audio.originalFilename;
        return (
          <li
            key={audio.id}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken px-2 py-1"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {label}
            </span>
            <span className="shrink-0 text-xs text-text-tertiary">
              {formatDuration(audio.durationSeconds)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(audio.id)}
              disabled={disabled}
              aria-label={`${label} を取り消す`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-50 shadow disabled:opacity-40"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
