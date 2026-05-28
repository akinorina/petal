export type AnalyticsProps = Record<string, string | number | boolean>;

/**
 * analytics イベントの発火口。送信基盤は未導入のため、現状は console 出力と
 * `petal:analytics` CustomEvent の dispatch のみを行う。基盤導入時はこの関数の
 * 中身を差し替えればよい。SSR では no-op。
 */
export function trackEvent(name: string, props?: AnalyticsProps): void {
  if (typeof window === 'undefined') return;
  console.info('[analytics]', name, props ?? {});
  window.dispatchEvent(
    new CustomEvent('petal:analytics', { detail: { name, props: props ?? {} } }),
  );
}
