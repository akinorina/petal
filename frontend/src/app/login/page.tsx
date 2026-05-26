'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { FormField } from '@/design-system/components/FormField';
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
            <FormField label="メールアドレス" isRequired>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField label="パスワード" isRequired>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            {error && <Alert variant="danger">{error}</Alert>}

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
            <Alert variant="warning">
              初回ログインです。新しいパスワードを設定してください。
            </Alert>

            <FormField label="メールアドレス">
              <Input type="email" value={step.email} disabled />
            </FormField>

            <FormField label="新しいパスワード" isRequired>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
            </FormField>

            <FormField label="新しいパスワード（確認）" isRequired>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </FormField>

            <PasswordPolicyChecklist
              password={newPassword}
              confirm={confirmPassword}
            />

            {error && <Alert variant="danger">{error}</Alert>}

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
            <Alert variant="info">
              認証アプリに表示されている 6 桁のコードを入力してください。
            </Alert>

            <FormField label="メールアドレス">
              <Input type="email" value={step.email} disabled />
            </FormField>

            <FormField label="認証コード" isRequired>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                autoFocus
                className="text-center font-mono tracking-[0.5em]"
              />
            </FormField>

            {error && <Alert variant="danger">{error}</Alert>}

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
