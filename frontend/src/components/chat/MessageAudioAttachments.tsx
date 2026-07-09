'use client';

import { formatDuration } from '@/lib/audio-constants';
import { AudioPlayer } from './AudioPlayer';

/**
 * バブル内に表示する添付音声の最小情報。
 * - サーバ確定メッセージ: `downloadUrl`（署名付き）を直接使う。
 * - 楽観バブル: `downloadUrl` 未取得のため `audioId` から取得する。
 */
export type DisplayAudioAttachment = {
  audioId: string;
  /** 署名付き URL（履歴は持つ・楽観は持たない）。 */
  downloadUrl?: string;
  /** ラベル（ファイル名等）。 */
  label?: string;
  /** 再生時間（秒）。ラベル表示に使う。 */
  durationSeconds?: number;
};

type MessageAudioAttachmentsProps = {
  attachments: DisplayAudioAttachment[];
};

/**
 * ユーザーバブル内の添付音声列（画像版 `MessageAttachments` と対称）。
 * `<AudioPlayer>` を縦に並べ、タイトル＋再生時間ラベルを付す。画像のような原寸 Dialog は持たない。
 * `downloadUrl` があれば直接再生し、なければ `audioId` から取得する（両対応）。
 */
export function MessageAudioAttachments({ attachments }: MessageAudioAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-2 space-y-2">
      {attachments.map((att) => {
        const label = att.label ?? '添付音声';
        return (
          <li key={att.audioId} className="rounded-md bg-surface-raised p-2">
            <p className="mb-1 truncate text-xs text-text-secondary">
              {label}
              {att.durationSeconds != null && (
                <span className="ml-2 text-text-tertiary">
                  {formatDuration(att.durationSeconds)}
                </span>
              )}
            </p>
            <AudioPlayer audioId={att.audioId} src={att.downloadUrl} label={label} />
          </li>
        );
      })}
    </ul>
  );
}
