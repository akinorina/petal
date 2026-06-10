# フロントエンドアーキテクチャ

Next.js（App Router）+ React + Tailwind CSS。ページは View に専念させ、ロジックはカスタムフックに分離する。

## ディレクトリ構成

```text
frontend/
  src/
    app/                       # Next.js App Router
      login/                   # ログイン
      signup/                  # セルフサインアップ
      forgot-password/         # パスワードリセット
      ~offline/                # オフラインフォールバック（PWA）
      (admin)/                 # 認証必須ルートグループ
        images/                # 画像一覧
          [id]/                # 画像詳細
        me/                    # マイページ（profile / password / email / mfa）
        (admin-only)/          # admin のみ（layout で role ガード）
          users/               # ユーザー管理
          audit-logs/          # 監査ログ
    components/                # 共有コンポーネント
    contexts/                  # AuthContext
    design-system/             # UI コンポーネント・トークン
    lib/
      api.ts                   # ドメイン別 API ラッパ
      api-hooks/               # API アクセス専用フック
      openapi/                 # 型付きクライアント（自動生成 + middleware）
  public/                      # 静的ファイル・PWA アイコン・manifest
  scripts/                     # 運用スクリプト（環境切替など）
  serwist.config.ts            # Service Worker 設定（PWA）
```

## ページとフックの分離

ページコンポーネント（`app/**/page.tsx`）は **View（JSX）に専念**させ、ステート・副作用・イベントハンドラは **同居するカスタムフック** `use-<page>-page.ts` に切り出す。

```text
app/login/
  page.tsx              # JSX のみ。フックから props/handler を受け取り render
  use-login-page.ts     # useState / useEffect / useCallback / API 呼び出し
```

- フックはページと同じディレクトリに置き `use-<page>-page.ts` 命名。
- `'use client'` はページ側のみが持つ。
- 1 ページ 1 フックを基本とし、無理に細分化しない。

## API アクセスの分離

ページフックに直接 API 呼び出しを書かず、**API アクセス専用フック**に分離して `lib/api-hooks/` に置く。

```text
lib/api-hooks/
  use-api-resource.ts      # 取得系フックの共通土台（data/isLoading/error + 自動再取得）
  use-auth-api.ts          # ログイン / ログアウト / サインアップ / パスワードリセット 等
  use-users-api.ts         # ユーザー一覧 / CRUD / 復活 / 招待再送
  use-images-api.ts        # 画像一覧 / アップロード / 削除
  use-image-detail-api.ts  # 画像詳細 / ダウンロード URL / 削除
  use-me-api.ts            # 自分のプロフィール取得 / 更新 / パスワード変更
  use-me-email-api.ts      # メールアドレス変更
  use-mfa-api.ts           # MFA 状態 / 設定 / 有効化 / 解除
  use-audit-logs-api.ts    # 監査ログ
```

- 取得系フックは共通土台 `useApiResource<T>(fetcher)` の上に実装し、状態管理と自動再取得の重複を避ける。
- API フックは **取得状態（data / isLoading / error）** と **操作関数（reload / create / update 等）** を返す。
- 操作関数は失敗時に例外を `throw` し、呼び出し側（ページフック）が UI 文脈に応じたメッセージを `setError` する（API フック内で UI 文言を決め打ちしない）。
- ページフックは「UI 状態 + API フックのオーケストレーション」だけを行い、`@/lib/api` や `lib/openapi` を直接呼ばない。

## 認証状態（AuthContext）

- `AuthContext` は **認証グローバル状態**（`isAuthenticated`, `email`, `role`, `isLoading`）の保持に専念。
- 認証 API 操作（login / logout / completeNewPassword / requestPasswordReset / confirmPasswordReset 等）は `useAuthApi` が担う。
- `AuthContext` 内部で `useAuthApi` を呼び、結果に応じて状態を更新する。アプリ側は `useAuth()` 経由で利用する。
- role は `GET /users/me` で取得し、TopBar のナビ表示やルートガードに使う（[20_features/05_authorization.md](../20_features/05_authorization.md)）。

## 型付き API クライアント

バックエンドの OpenAPI から型を生成し、`openapi-typescript` + `openapi-fetch` で型付きクライアントを作る。詳細は [06_api-design.md](06_api-design.md)。

- アクセストークン付与は `lib/openapi/client.ts` の middleware で自動化（`getAccessToken()`）。
- リフレッシュトークンによる自動更新も middleware で行う（[20_features/01_authentication.md](../20_features/01_authentication.md)）。
- UI からは `lib/api.ts` の `imageApi` / `userApi` 等を使い、`apiClient` を直接呼ばない（共通エラー処理 `unwrap()` を経由）。

## デザインシステム

`src/design-system/` に再利用 UI コンポーネント（Button, Card, Dialog, FormField, Pagination, Popover, Avatar, TopBar, AppShell ほか多数）とトークンを持つ。画面はこれらを組み合わせて構築する。

## 関連ドキュメント

- 認証フロー → [20_features/01_authentication.md](../20_features/01_authentication.md)
- 認可（ナビ/ルートガード）→ [20_features/05_authorization.md](../20_features/05_authorization.md)
- API 設計 → [06_api-design.md](06_api-design.md)
- 原典 → [specs/00_rules.md](../specs/00_rules.md) §3, [specs/43_frontend-auth-refactor.md](../specs/43_frontend-auth-refactor.md)
