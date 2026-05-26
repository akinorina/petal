'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthApi } from '@/lib/api-hooks/use-auth-api';
import { evaluatePasswordForm } from '@/lib/password-policy';

type Step = { kind: 'request' } | { kind: 'confirm'; email: string };

export function useForgotPasswordPage() {
  const router = useRouter();
  const api = useAuthApi();
  const [step, setStep] = useState<Step>({ kind: 'request' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await api.requestPasswordReset(email);
      setStep({ kind: 'confirm', email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コード送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  const newPasswordCheck = evaluatePasswordForm(newPassword, confirmPassword);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'confirm') return;
    if (!newPasswordCheck.policyOk) {
      setError('パスワードがポリシーを満たしていません');
      return;
    }
    if (!newPasswordCheck.match) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmPasswordReset(step.email, code, newPassword);
      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'パスワード設定に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function backToRequest() {
    setStep({ kind: 'request' });
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    isLoading,
    newPasswordCheck,
    handleRequest,
    handleConfirm,
    backToRequest,
  };
}
