'use client';

import Link from 'next/link';
import { PasswordPolicyChecklist } from '@/components/PasswordPolicyChecklist';
import { useLoginPage } from './use-login-page';

export default function LoginPage() {
  const {
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
  } = useLoginPage();

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          Petal
        </h1>

        {step.kind === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="メールアドレス">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="パスワード">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-zinc-500 hover:text-zinc-900"
              >
                パスワードを忘れた方
              </Link>
            </p>
          </form>
        )}

        {step.kind === 'new-password' && (
          <form onSubmit={handleNewPassword} className="space-y-4">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              初回ログインです。新しいパスワードを設定してください。
            </p>

            <Field label="メールアドレス">
              <input
                type="email"
                value={step.email}
                disabled
                className={`${inputClass} bg-zinc-50 text-zinc-500`}
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

            <PasswordPolicyChecklist
              password={newPassword}
              confirm={confirmPassword}
            />

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isLoading || !newPasswordCheck.canSubmit}
              className={primaryBtnClass}
            >
              {isLoading ? '設定中...' : 'パスワードを設定'}
            </button>
          </form>
        )}

        {step.kind === 'mfa' && (
          <form onSubmit={handleMfa} className="space-y-4">
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
              認証アプリに表示されている 6 桁のコードを入力してください。
            </p>

            <Field label="メールアドレス">
              <input
                type="email"
                value={step.email}
                disabled
                className={`${inputClass} bg-zinc-50 text-zinc-500`}
              />
            </Field>

            <Field label="認証コード">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                required
                autoFocus
                className={`${inputClass} text-center font-mono tracking-[0.5em]`}
              />
            </Field>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isLoading || mfaCode.length !== 6}
              className={primaryBtnClass}
            >
              {isLoading ? '確認中...' : '確認'}
            </button>
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
