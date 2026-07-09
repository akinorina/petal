import './AudioPlayer.css';

export interface AudioPlayerProps {
  /** 再生する音声 URL。未確定（取得中）は undefined。 */
  src?: string;
  /** `<audio>` の aria-label（ファイル名等）。 */
  label?: string;
  /** src 未確定（取得中）。true の間は読込プレースホルダーを表示する。 */
  isLoading?: boolean;
  /** 取得失敗。true のとき失敗表示（再読込）を出す。 */
  hasError?: boolean;
  /** 「再読込」押下時のハンドラ。 */
  onRetry?: () => void;
  /** `<audio>` の onError（再生失敗）を親へ通知する。 */
  onError?: () => void;
  className?: string;
}

/**
 * 非同期音声（署名 URL）の純表示 shell（`MediaThumb` の音声版）。
 * 取得ロジックは持たず、`src` / `isLoading` / `hasError` を親から受けて
 * 「読込中プレースホルダー / 失敗+再読込 / `<audio>` 再生」を切り替える controlled 部品。
 */
export function AudioPlayer({
  src,
  label,
  isLoading = false,
  hasError = false,
  onRetry,
  onError,
  className,
}: AudioPlayerProps) {
  if (hasError) {
    return (
      <div className={['ds-audio-player__error', className].filter(Boolean).join(' ')}>
        <span>読み込み失敗</span>
        <button type="button" className="ds-audio-player__retry" onClick={() => onRetry?.()}>
          再読込
        </button>
      </div>
    );
  }

  if (!src || isLoading) {
    return (
      <div className={['ds-audio-player__loading', className].filter(Boolean).join(' ')} />
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={src}
      aria-label={label ?? '添付音声'}
      className={['ds-audio-player', className].filter(Boolean).join(' ')}
      onError={onError}
    />
  );
}
