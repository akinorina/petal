'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '@/lib/cognito';

type Step =
  | { kind: 'request' }
  | { kind: 'confirm'; email: string };

export default function ForgotPasswordPage() {
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
      setError(
        err instanceof Error ? err.message : 'コード送信に失敗しました',
      );
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

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          Petal
        </h1>

        {step.kind === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-zinc-600">
              登録メールアドレスに検証コードを送信します。
            </p>

            <Field label="メールアドレス">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnClass}
            >
              {isLoading ? '送信中...' : 'コードを送信'}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/login"
                className="text-zinc-500 hover:text-zinc-900"
              >
                ログイン画面へ戻る
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {step.email} 宛にコードを送信しました。受信メールのコードと新しいパスワードを入力してください。
            </p>

            <Field label="検証コード">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="新しいパスワード">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </Field>

            <Field label="新しいパスワード（確認）">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </Field>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnClass}
            >
              {isLoading ? '設定中...' : 'パスワードを設定'}
            </button>

            <p className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep({ kind: 'request' });
                  setCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError(null);
                }}
                className="text-zinc-500 hover:text-zinc-900"
              >
                メールアドレスを入力し直す
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </p>
  );
}

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';
const primaryBtnClass =
  'w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50';
