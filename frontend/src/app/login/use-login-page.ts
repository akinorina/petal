'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { evaluatePasswordForm } from '@/lib/password-policy';

type Step =
  | { kind: 'login' }
  | { kind: 'new-password'; email: string; session: string }
  | { kind: 'mfa'; email: string; session: string };

export function useLoginPage() {
  const router = useRouter();
  const { login, completeNewPassword, respondMfaChallenge } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'login' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
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
      } else if (result.kind === 'mfa_challenge') {
        setStep({
          kind: 'mfa',
          email: result.email,
          session: result.session,
        });
        setPassword('');
      } else {
        router.push('/images');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'mfa') return;

    if (mfaCode.length !== 6) {
      setError('6 桁のコードを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      await respondMfaChallenge(step.email, mfaCode, step.session);
      router.push('/images');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MFA 認証に失敗しました');
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  }

  const newPasswordCheck = evaluatePasswordForm(newPassword, confirmPassword);

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'new-password') return;

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
      await completeNewPassword(step.email, newPassword, step.session);
      router.push('/images');
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
    mfaCode,
    setMfaCode,
    error,
    isLoading,
    newPasswordCheck,
    handleLogin,
    handleNewPassword,
    handleMfa,
  };
}
