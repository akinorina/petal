'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_RECORDING_SECONDS,
  pickRecordingMimeType,
  recordingBlobToFile,
  type AudioMimeType,
} from './audio-constants';

export type RecorderStatus = 'idle' | 'recording' | 'recorded';

export type AudioRecorder = {
  /** 録音状態。idle → recording → recorded。 */
  status: RecorderStatus;
  /** この環境でマイク録音が可能か（MediaRecorder / getUserMedia / 対応 MIME の有無）。 */
  isSupported: boolean;
  /** 録音中の経過秒（整数）。 */
  elapsedSeconds: number;
  /** 録音結果の File（アップロード経路にそのまま流せる）。未録音は null。 */
  recordedFile: File | null;
  /** 録音結果のプレビュー用 objectURL。未録音は null。 */
  previewUrl: string | null;
  /** エラーメッセージ。なければ null。 */
  error: string | null;
  /** 録音を開始する。 */
  start: () => Promise<void>;
  /** 録音を停止する。 */
  stop: () => void;
  /** 録音結果を破棄して idle に戻す。 */
  reset: () => void;
};

function detectSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    pickRecordingMimeType() !== null
  );
}

function toErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      return 'マイクの使用が許可されませんでした';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'マイクが見つかりません';
    }
  }
  return '録音を開始できませんでした';
}

/**
 * マイク録音（MediaRecorder）の状態・経過秒・録音 File を提供するフック。
 * 状態と副作用（getUserMedia / MediaRecorder / タイマー / stream・objectURL の後始末）を
 * 集約し、利用側コンポーネントは View に専念できる。
 */
export function useAudioRecorder(): AudioRecorder {
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(detectSupported());
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const mimeType = pickRecordingMimeType();
    if (mimeType === null || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setError('お使いのブラウザは録音に対応していません');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(toErrorMessage(err));
      return;
    }

    // 直前の録音結果があれば破棄してから新規録音を始める。
    revokePreview();
    setPreviewUrl(null);
    setRecordedFile(null);

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    });

    recorder.addEventListener('stop', () => {
      clearTimer();
      stopStream();
      const baseMime: AudioMimeType = mimeType;
      const blob = new Blob(chunksRef.current, { type: baseMime });
      const file = recordingBlobToFile(blob, baseMime);
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setRecordedFile(file);
      setStatus('recorded');
    });

    recorder.start();
    setElapsedSeconds(0);
    setStatus('recording');

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
    }, 250);
  }, [clearTimer, revokePreview, stopStream]);

  const reset = useCallback(() => {
    clearTimer();
    stopStream();
    revokePreview();
    recorderRef.current = null;
    chunksRef.current = [];
    setPreviewUrl(null);
    setRecordedFile(null);
    setElapsedSeconds(0);
    setError(null);
    setStatus('idle');
  }, [clearTimer, stopStream, revokePreview]);

  // アンマウント時に録音・タイマー・stream・objectURL を確実に後始末する。
  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [clearTimer]);

  return {
    status,
    isSupported,
    elapsedSeconds,
    recordedFile,
    previewUrl,
    error,
    start,
    stop,
    reset,
  };
}
