'use client';

import NextLink from 'next/link';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
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
        <Text as="h1" variant="heading-lg" align="center" className="mb-8">
          Petal
        </Text>

        {step.kind === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="メールアドレス">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>

            <Field label="パスワード">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && <ErrorBanner message={error} />}

            <Button type="submit" isFullWidth isLoading={isLoading}>
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>

            <p className="text-center text-sm">
              <NextLink
                href="/forgot-password"
                className="ds-link ds-link--inline"
              >
                パスワードを忘れた方
              </NextLink>
            </p>
          </form>
        )}

        {step.kind === 'new-password' && (
          <form onSubmit={handleNewPassword} className="space-y-4">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              初回ログインです。新しいパスワードを設定してください。
            </p>

            <Field label="メールアドレス">
              <Input type="email" value={step.email} disabled />
            </Field>

            <Field label="新しいパスワード">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>

            <Field label="新しいパスワード（確認）">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>

            <PasswordPolicyChecklist
              password={newPassword}
              confirm={confirmPassword}
            />

            {error && <ErrorBanner message={error} />}

            <Button
              type="submit"
              isFullWidth
              isLoading={isLoading}
              disabled={!newPasswordCheck.canSubmit}
            >
              {isLoading ? '設定中...' : 'パスワードを設定'}
            </Button>
          </form>
        )}

        {step.kind === 'mfa' && (
          <form onSubmit={handleMfa} className="space-y-4">
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
              認証アプリに表示されている 6 桁のコードを入力してください。
            </p>

            <Field label="メールアドレス">
              <Input type="email" value={step.email} disabled />
            </Field>

            <Field label="認証コード">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                required
                autoFocus
                className="text-center font-mono tracking-[0.5em]"
              />
            </Field>

            {error && <ErrorBanner message={error} />}

            <Button
              type="submit"
              isFullWidth
              isLoading={isLoading}
              disabled={mfaCode.length !== 6}
            >
              {isLoading ? '確認中...' : '確認'}
            </Button>
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
