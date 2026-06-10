'use client';

import { useEffect, useState } from 'react';
import { useAuthApi } from '@/lib/api-hooks/use-auth-api';
import { evaluatePasswordForm } from '@/lib/password-policy';

type Step =
  | { kind: 'form' }
  | { kind: 'confirm'; email: string; name: string; nameKana: string }
  | { kind: 'done' };

// セルフ登録可否の取得状態。取得前は loading、失敗時は disabled に倒す。
type ConfigStatus = 'loading' | 'enabled' | 'disabled';

export function useSignupPage() {
  const api = useAuthApi();
  const { getSignupConfig } = api;
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [configStatus, setConfigStatus] = useState<ConfigStatus>('loading');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getSignupConfig()
      .then((config) => {
        if (active) setConfigStatus(config.enabled ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (active) setConfigStatus('disabled');
      });
    return () => {
      active = false;
    };
  }, [getSignupConfig]);

  const passwordCheck = evaluatePasswordForm(password, confirmPassword);

  const isFormValid =
    email.trim() !== '' &&
    name.trim() !== '' &&
    nameKana.trim() !== '' &&
    passwordCheck.canSubmit;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isFormValid) {
      setError('入力内容を確認してください');
      return;
    }

    setIsLoading(true);
    try {
      await api.signup(email, password, name, nameKana);
      setStep({ kind: 'confirm', email, name, nameKana });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サインアップに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'confirm') return;
    if (code.trim() === '') {
      setError('検証コードを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmSignup(step.email, code, step.name, step.nameKana);
      setStep({ kind: 'done' });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'サインアップの確定に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function backToForm() {
    setStep({ kind: 'form' });
    setCode('');
    setError(null);
  }

  return {
    step,
    configStatus,
    email,
    setEmail,
    name,
    setName,
    nameKana,
    setNameKana,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    code,
    setCode,
    error,
    isLoading,
    passwordCheck,
    isFormValid,
    handleSignup,
    handleConfirm,
    backToForm,
  };
}
