'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { PasswordPolicyChecklist } from '@/components/PasswordPolicyChecklist';
import { useSignupPage } from './use-signup-page';

export default function SignupPage() {
  const {
    step,
    configStatus,
    email,
    setEmail,
    name,
    setName,
    nameKana,
    setNameKana,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    code,
    setCode,
    error,
    isLoading,
    isFormValid,
    handleSignup,
    handleConfirm,
    backToForm,
  } = useSignupPage();

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <Text as="h1" variant="heading-lg" align="center" className="mb-8">
          Petal
        </Text>

        {configStatus === 'loading' && (
          <Text align="center" className="text-zinc-600">
            読み込み中...
          </Text>
        )}

        {configStatus === 'disabled' && (
          <div className="space-y-4">
            <Alert variant="info">現在ユーザー登録は受け付けていません。</Alert>
            <p className="text-center text-sm">
              <NextLink href="/login" className="ds-link ds-link--inline">
                ログイン画面へ戻る
              </NextLink>
            </p>
          </div>
        )}

        {configStatus === 'enabled' && step.kind === 'form' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <p className="text-sm text-zinc-600">
              アカウントを作成します。入力後、メールに届く検証コードで確定します。
            </p>

            <FormField label="メールアドレス" isRequired>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField label="氏名" isRequired>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>

            <FormField label="氏名（ふりがな）" isRequired>
              <Input
                type="text"
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
              />
            </FormField>

            <FormField label="パスワード" isRequired>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </FormField>

            <FormField label="パスワード（確認）" isRequired>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </FormField>

            <PasswordPolicyChecklist
              password={password}
              confirm={confirmPassword}
            />

            {error && <Alert variant="danger">{error}</Alert>}

            <Button
              type="submit"
              isFullWidth
              isLoading={isLoading}
              disabled={!isFormValid}
            >
              {isLoading ? '送信中...' : '確認コードを送信'}
            </Button>

            <p className="text-center text-sm">
              <NextLink href="/login" className="ds-link ds-link--inline">
                ログイン画面へ戻る
              </NextLink>
            </p>
          </form>
        )}

        {step.kind === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <Alert variant="warning">
              {step.email} 宛に検証コードを送信しました。メールのコードを入力してください。
            </Alert>

            <FormField label="検証コード" isRequired>
              <Input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </FormField>

            {error && <Alert variant="danger">{error}</Alert>}

            <Button type="submit" isFullWidth isLoading={isLoading}>
              {isLoading ? '確認中...' : '登録を完了する'}
            </Button>

            <p className="text-center text-sm">
              <button
                type="button"
                onClick={backToForm}
                className="ds-link ds-link--inline"
              >
                入力し直す
              </button>
            </p>
          </form>
        )}

        {step.kind === 'done' && (
          <div className="space-y-4">
            <Alert variant="success">
              登録が完了しました。ログインしてご利用ください。
            </Alert>
            <p className="text-center text-sm">
              <NextLink href="/login" className="ds-link ds-link--inline">
                ログイン画面へ
              </NextLink>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
