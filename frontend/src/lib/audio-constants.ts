import type { Schemas } from './openapi/client';

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
] as const;

export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

export type AudioMimeType = Schemas['CreateAudioRequestDto']['mimeType'];

export function formatAudioSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 再生時間（秒）を mm:ss 形式に整形する。null や不正値は「—」。 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export type AudioFileValidation =
  | { ok: true; file: File; mimeType: AudioMimeType }
  | { ok: false; message: string };

export function validateAudioFile(file: File): AudioFileValidation {
  if (!(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: `対応していないファイル形式です: ${file.type || '不明'}（MP3/WAV/WebM/MP4/OGG のみ）`,
    };
  }
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return {
      ok: false,
      message: `ファイルサイズが上限 (${formatAudioSize(MAX_AUDIO_SIZE_BYTES)}) を超えています`,
    };
  }
  return { ok: true, file, mimeType: file.type as AudioMimeType };
}

/**
 * 音声ファイルの再生時間（秒・整数）を計測する。
 * 計測できない（メタデータ読込失敗・ストリーミング等で duration 不定）場合は null。
 */
export function measureAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => URL.revokeObjectURL(url);

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      cleanup();
      resolve(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null);
    });
    audio.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });

    audio.preload = 'metadata';
    audio.src = url;
  });
}
