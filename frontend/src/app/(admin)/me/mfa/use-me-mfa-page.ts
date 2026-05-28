'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, mfaApi, userApi } from '@/lib/api';

type Step =
  | { kind: 'idle' }
  | { kind: 'setup'; secretCode: string; otpauthUri: string };

export function useMeMfaPage() {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await userApi.findMe();
      setEnabled(me.mfaEnabled ?? false);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'MFA 状態の取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function startSetup() {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const result = await mfaApi.setup();
      setStep({
        kind: 'setup',
        secretCode: result.secretCode,
        otpauthUri: result.otpauthUri,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'MFA 設定の開始に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifySetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError('6 桁のコードを入力してください');
      return;
    }
    setIsSubmitting(true);
    try {
      await mfaApi.verify(code);
      setSuccess('MFA を有効化しました。次回ログインからコード入力が必要になります。');
      setStep({ kind: 'idle' });
      setCode('');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'MFA の有効化に失敗しました');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function disable() {
    setError(null);
    setSuccess(null);
    if (!confirm('MFA を解除しますか？')) return;
    setIsSubmitting(true);
    try {
      await mfaApi.disable();
      setSuccess('MFA を解除しました。');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'MFA の解除に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  function cancelSetup() {
    setStep({ kind: 'idle' });
    setCode('');
    setError(null);
  }

  return {
    step,
    enabled,
    code,
    setCode,
    isLoading,
    isSubmitting,
    error,
    success,
    startSetup,
    verifySetup,
    disable,
    cancelSetup,
  };
}
