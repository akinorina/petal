'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthApi } from '@/lib/api-hooks/use-auth-api';
import { consumeAuthNotice } from '@/lib/auth-session';
import { evaluatePasswordForm } from '@/lib/password-policy';

type Step =
  | { kind: 'login' }
  | { kind: 'new-password'; email: string; session: string }
  | { kind: 'mfa'; email: string; session: string };

export function useLoginPage() {
  const router = useRouter();
  const { login, completeNewPassword, respondMfaChallenge } = useAuth();
  const { getSignupConfig } = useAuthApi();
  const [step, setStep] = useState<Step>({ kind: 'login' });
  // セルフ登録が有効なときのみ「アカウントを作成」導線を出す。
  // 取得前・取得失敗時は false（導線非表示）にフォールバックする。
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // sessionStorage を読むため SSR/hydration では空のまま、マウント後に 1 回だけ取り出す。
  // useState の lazy initializer で取ると SSR との hydration mismatch を起こすため
  // やむを得ず effect で setState する。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice(consumeAuthNotice());
  }, []);

  useEffect(() => {
    let active = true;
    getSignupConfig()
      .then((config) => {
        if (active) setSignupEnabled(config.enabled);
      })
      .catch(() => {
        if (active) setSignupEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [getSignupConfig]);

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
    notice,
    isLoading,
    signupEnabled,
    newPasswordCheck,
    handleLogin,
    handleNewPassword,
    handleMfa,
  };
}
