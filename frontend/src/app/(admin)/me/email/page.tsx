'use client';

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
        <a
          href="/me/mfa"
          className="text-zinc-500 hover:text-zinc-900"
        >
          2 段階認証
        </a>
      </nav>
      <h1 className="text-lg font-semibold">メールアドレス変更</h1>

      <div className="mt-4 rounded border border-zinc-200 bg-white p-4 text-sm">
        <div className="text-zinc-500">現在のメールアドレス</div>
        <div className="mt-1 font-medium">{currentEmail ?? '-'}</div>
      </div>

      {successMessage && (
        <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {step.kind === 'request' ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitRequest();
          }}
        >
          <div>
            <label
              htmlFor="newEmail"
              className="block text-sm font-medium text-zinc-700"
            >
              新しいメールアドレス
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="new@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !newEmail}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? '送信中...' : 'コードを送信'}
          </button>
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
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-zinc-700"
            >
              検証コード
            </label>
            <input
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !code}
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? '確定中...' : '確定する'}
            </button>
            <button
              type="button"
              onClick={cancelConfirm}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
