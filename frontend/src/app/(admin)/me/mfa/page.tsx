'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/design-system/components/Button';
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
        <a href="/me/email" className="ds-link ds-link--inline">
          メールアドレス変更
        </a>
        <span className="font-medium text-zinc-900">2 段階認証</span>
      </nav>
      <Text as="h1" variant="heading-md">2 段階認証 (MFA)</Text>

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <div className="rounded border border-zinc-200 bg-white p-4 text-sm">
          {success && (
            <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
              {success}
            </p>
          )}
          {error && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-red-700">
              {error}
            </p>
          )}

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

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  認証コード
                </label>
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
                  required
                  autoFocus
                  className="text-center font-mono tracking-[0.5em]"
                />
              </div>

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
      )}
    </div>
  );
}
