'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { PasswordPolicyChecklist } from '@/components/PasswordPolicyChecklist';
import { useForgotPasswordPage } from './use-forgot-password-page';

export default function ForgotPasswordPage() {
  const {
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
  } = useForgotPasswordPage();

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <Text as="h1" variant="heading-lg" align="center" className="mb-8">
          Petal
        </Text>

        {step.kind === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-zinc-600">
              登録メールアドレスに検証コードを送信します。
            </p>

            <FormField label="メールアドレス" isRequired>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            {error && <Alert variant="danger">{error}</Alert>}

            <Button type="submit" isFullWidth isLoading={isLoading}>
              {isLoading ? '送信中...' : 'コードを送信'}
            </Button>

            <p className="text-center text-sm">
              <NextLink href="/login" className="ds-link ds-link--inline">
                ログイン画面へ戻る
              </NextLink>
            </p>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <Alert variant="warning">
              {step.email} 宛にコードを送信しました。受信メールのコードと新しいパスワードを入力してください。
            </Alert>

            <FormField label="検証コード" isRequired>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
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

            <p className="text-center text-sm">
              <button
                type="button"
                onClick={backToRequest}
                className="ds-link ds-link--inline"
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
