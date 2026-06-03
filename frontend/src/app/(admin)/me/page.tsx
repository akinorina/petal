'use client';

import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { useMePage } from './use-me-page';

export default function MePage() {
  const {
    email,
    name,
    setName,
    nameKana,
    setNameKana,
    isLoading,
    isSubmitting,
    error,
    successMessage,
    canSubmit,
    submit,
  } = useMePage();

  return (
    <div className="mx-auto max-w-md">
      <nav className="mb-4 flex gap-3 text-xs">
        <span className="font-medium text-zinc-900">プロフィール</span>
        <a href="/me/email" className="ds-link ds-link--inline">
          メールアドレス変更
        </a>
        <a href="/me/mfa" className="ds-link ds-link--inline">
          2 段階認証
        </a>
        <a href="/me/password" className="ds-link ds-link--inline">
          パスワード変更
        </a>
      </nav>
      <Text as="h1" variant="heading-md">プロフィール</Text>

      <Card padding="md" className="mt-4 text-sm">
        <div className="text-zinc-500">メールアドレス</div>
        <div className="mt-1 font-medium">{email ?? '-'}</div>
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

      {isLoading ? (
        <p className="mt-6 text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField label="氏名" isRequired>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="氏名（ふりがな）" isRequired>
            <Input
              value={nameKana}
              onChange={(e) => setNameKana(e.target.value)}
            />
          </FormField>
          <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit}>
            {isSubmitting ? '保存中...' : '保存する'}
          </Button>
        </form>
      )}
    </div>
  );
}
