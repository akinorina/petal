'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useMfaApi } from '@/lib/api-hooks/use-mfa-api';

type Step =
  | { kind: 'idle' }
  | { kind: 'setup'; secretCode: string; otpauthUri: string };

export function useMeMfaPage() {
  const {
    enabled,
    isLoading,
    error,
    setError,
    reload,
    setup,
    verify,
    disable: disableMfa,
  } = useMfaApi();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function startSetup() {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const result = await setup();
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
      await verify(code);
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
      await disableMfa();
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
