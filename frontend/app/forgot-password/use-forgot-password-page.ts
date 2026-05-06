'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '@/lib/cognito';

type Step = { kind: 'request' } | { kind: 'confirm'; email: string };

export function useForgotPasswordPage() {
  const router = useRouter();
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
      await requestPasswordReset(email);
      setStep({ kind: 'confirm', email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コード送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (step.kind !== 'confirm') return;

    setIsLoading(true);
    try {
      await confirmPasswordReset(step.email, code, newPassword);
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
    handleRequest,
    handleConfirm,
    backToRequest,
  };
}
