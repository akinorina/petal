import type { Schemas } from './openapi/client';

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
] as const;

export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

/** マイク録音の最大録音時間（秒）。上限到達で自動停止する。 */
export const MAX_RECORDING_SECONDS = 30;

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
 * MediaRecorder が報告する MIME（例: `audio/webm;codecs=opus`）から
 * codecs サフィックスを除いた base MIME（例: `audio/webm`）を返す。
 */
export function stripCodecs(mime: string): string {
  return mime.split(';')[0].trim();
}

/**
 * マイク録音に使う MIME を決める。`audio/webm` を優先し、未対応なら `audio/mp4`
 * （Safari 等）へフォールバックする。どちらも未対応・MediaRecorder 非対応環境では null。
 */
export function pickRecordingMimeType(): AudioMimeType | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: AudioMimeType[] = ['audio/webm', 'audio/mp4'];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/**
 * 録音 Blob を、既存アップロード経路に流せる File に変換する。
 * ファイル名は `recording-<yyyyMMdd-HHmmss>.<ext>`、type は base MIME（codecs 除去済み）。
 */
export function recordingBlobToFile(blob: Blob, mimeType: AudioMimeType): File {
  const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return new File([blob], `recording-${stamp}.${ext}`, { type: mimeType });
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
