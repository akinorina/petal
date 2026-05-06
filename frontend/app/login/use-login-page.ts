'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Step =
  | { kind: 'login' }
  | { kind: 'new-password'; email: string; session: string };

export function useLoginPage() {
  const router = useRouter();
  const { login, completeNewPassword } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'login' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.kind === 'challenge') {
        setStep({
          kind: 'new-password',
          email: result.email,
          session: result.session,
        });
        setPassword('');
      } else {
        router.push('/users');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'new-password') return;

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);
    try {
      await completeNewPassword(step.email, newPassword, step.session);
      router.push('/users');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'パスワード設定に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return {
    step,
    email,
    setEmail,
    password,
    setPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    isLoading,
    handleLogin,
    handleNewPassword,
  };
}
