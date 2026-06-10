'use client';

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ApiError } from '@/lib/api';

const DEFAULT_ERROR_MESSAGE = 'データの取得に失敗しました';

export type ApiResource<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  reload: () => Promise<void>;
};

/**
 * API 取得系フックの共通土台。`data / isLoading / error / reload` の状態管理と
 * マウント時・`fetcher` 変化時の自動再取得をまとめる。
 *
 * `fetcher` は呼び出し側で `useCallback` により安定化させること
 * （依存が変わったときだけ再取得される）。失敗時は `ApiError` の
 * メッセージを、それ以外は `errorMessage` を `error` に設定する。
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  errorMessage: string = DEFAULT_ERROR_MESSAGE,
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, errorMessage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { data, isLoading, error, setError, reload };
}
