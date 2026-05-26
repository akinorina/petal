'use client';

import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { useMeEmailPage } from './use-me-email-page';

export default function MeEmailPage() {
  const {
    currentEmail,
    step,
    newEmail,
    setNewEmail,
    code,
    setCode,
    isSubmitting,
    error,
    successMessage,
    submitRequest,
    submitConfirm,
    cancelConfirm,
  } = useMeEmailPage();

  return (
    <div className="mx-auto max-w-md">
      <nav className="mb-4 flex gap-3 text-xs">
        <span className="font-medium text-zinc-900">メールアドレス変更</span>
        <a href="/me/mfa" className="ds-link ds-link--inline">
          2 段階認証
        </a>
      </nav>
      <Text as="h1" variant="heading-md">メールアドレス変更</Text>

      <Card padding="md" className="mt-4 text-sm">
        <div className="text-zinc-500">現在のメールアドレス</div>
        <div className="mt-1 font-medium">{currentEmail ?? '-'}</div>
      </Card>

      {successMessage && (
        <Alert variant="success" className="mt-4">
          {successMessage}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {step.kind === 'request' ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitRequest();
          }}
        >
          <FormField label="新しいメールアドレス" isRequired>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
            />
          </FormField>
          <Button type="submit" isLoading={isSubmitting} disabled={!newEmail}>
            {isSubmitting ? '送信中...' : 'コードを送信'}
          </Button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitConfirm();
          }}
        >
          <p className="text-sm text-zinc-600">
            <span className="font-medium">{step.pendingEmail}</span>{' '}
            に送信した検証コードを入力してください。
          </p>
          <FormField label="検証コード" isRequired>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </FormField>
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={isSubmitting} disabled={!code}>
              {isSubmitting ? '確定中...' : '確定する'}
            </Button>
            <button
              type="button"
              onClick={cancelConfirm}
              className="ds-link ds-link--inline text-sm"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
