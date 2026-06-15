'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Text } from '@/design-system/components/Text';
import { useMeMfaPage } from './use-me-mfa-page';

export default function MeMfaPage() {
  const {
    step,
    enabled,
    code,
    setCode,
    isLoading,
    isSubmitting,
    error,
    success,
    startSetup,
    verifySetup,
    disable,
    cancelSetup,
  } = useMeMfaPage();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <nav className="flex gap-3 text-xs">
        <a href="/me" className="ds-link ds-link--inline">
          プロフィール
        </a>
        <a href="/me/email" className="ds-link ds-link--inline">
          メールアドレス変更
        </a>
        <span className="font-medium text-zinc-900">2 段階認証</span>
        <a href="/me/password" className="ds-link ds-link--inline">
          パスワード変更
        </a>
      </nav>
      <Text as="h1" variant="heading-md">2 段階認証 (MFA)</Text>

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <Card padding="md">
          <div className="space-y-3 text-sm">
            {success && <Alert variant="success">{success}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}

            {step.kind === 'idle' &&
              (enabled ? (
                <div className="space-y-3">
                  <p className="text-emerald-700">2 段階認証は有効です。</p>
                  <p className="text-xs text-zinc-500">
                    解除すると次回ログイン以降パスワードのみで認証されます。
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={disable}
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? '解除中...' : '解除する'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p>2 段階認証はまだ有効化されていません。</p>
                  <p className="text-xs text-zinc-500">
                    Authenticator アプリ（Google Authenticator、1Password 等）でコードを生成し、ログイン時に追加で入力します。
                  </p>
                  <Button
                    size="sm"
                    onClick={startSetup}
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? '準備中...' : '有効にする'}
                  </Button>
                </div>
              ))}

            {step.kind === 'setup' && (
              <form onSubmit={verifySetup} className="space-y-4">
                <p className="text-zinc-700">
                  Authenticator アプリで下記の QR コードをスキャンし、表示された 6 桁のコードを入力してください。
                </p>

                <div className="flex justify-center">
                  <div className="rounded border border-zinc-200 bg-white p-2">
                    <QRCodeSVG value={step.otpauthUri} size={180} />
                  </div>
                </div>

                <details className="text-xs text-zinc-500">
                  <summary className="cursor-pointer">
                    QR を読めない場合は手動で登録
                  </summary>
                  <p className="mt-2 break-all font-mono">{step.secretCode}</p>
                </details>

                <FormField label="認証コード" isRequired>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/[^0-9]/g, '').slice(0, 6),
                      )
                    }
                    autoFocus
                    className="text-center font-mono tracking-[0.5em]"
                  />
                </FormField>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSubmitting}
                    disabled={code.length !== 6}
                  >
                    {isSubmitting ? '確認中...' : '有効化を確定'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={cancelSetup}
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
