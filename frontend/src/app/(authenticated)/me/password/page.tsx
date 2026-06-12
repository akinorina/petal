'use client';

import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { PasswordPolicyChecklist } from '@/components/PasswordPolicyChecklist';
import { useMePasswordPage } from './use-me-password-page';

export default function MePasswordPage() {
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isSubmitting,
    error,
    canSubmit,
    submit,
  } = useMePasswordPage();

  return (
    <div className="mx-auto max-w-md">
      <nav className="mb-4 flex gap-3 text-xs">
        <a href="/me" className="ds-link ds-link--inline">
          プロフィール
        </a>
        <a href="/me/email" className="ds-link ds-link--inline">
          メールアドレス変更
        </a>
        <a href="/me/mfa" className="ds-link ds-link--inline">
          2 段階認証
        </a>
        <span className="font-medium text-zinc-900">パスワード変更</span>
      </nav>
      <Text as="h1" variant="heading-md">パスワード変更</Text>

      <p className="mt-2 text-sm text-zinc-600">
        変更するとすべての端末からログアウトされ、再ログインが必要になります。
      </p>

      {error && (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label="現在のパスワード" isRequired>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </FormField>
        <FormField label="新しいパスワード" isRequired>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="新しいパスワード（確認）" isRequired>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </FormField>

        <PasswordPolicyChecklist
          password={newPassword}
          confirm={confirmPassword}
        />

        <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit}>
          {isSubmitting ? '変更中...' : 'パスワードを変更'}
        </Button>
      </form>
    </div>
  );
}
