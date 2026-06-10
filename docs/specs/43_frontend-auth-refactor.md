# フロントエンド認証リファクタリング設計（TSK-43）

## 1. 背景・スコープ

### 1.1 タスクの当初前提と現状の差異

[Notion TSK-43](https://www.notion.so/35d9ca7d99dc8198b87df7efad6a91d3) の当初記述では次が前提とされていた。

- `frontend/lib/cognito.ts` は `amazon-cognito-identity-js` を使用したデッドコード
- `amazon-cognito-identity-js` パッケージ・`NEXT_PUBLIC_COGNITO_*` 変数を削除する必要がある

しかし `feat/tsk-42-operational-jobs` 時点でリポジトリを調査した結果、以下が判明している。

- `amazon-cognito-identity-js` は `frontend/package.json` から **既に除去済み**
- `NEXT_PUBLIC_COGNITO_*` 変数は `.env.local.example` / `.env.production.example` / `.env.dev` から **既に除去済み**
- リポジトリ全体で `amazon-cognito-identity-js` および `NEXT_PUBLIC_COGNITO_` への参照は **0 件**
- `frontend/lib/cognito.ts` の中身は既にバックエンド `/auth/*` への `fetch` 呼び出し + `localStorage` トークン管理に置き換わっており、**デッドコードではなく** 3 箇所から能動的に import されている
  - [frontend/contexts/AuthContext.tsx](../frontend/contexts/AuthContext.tsx)
  - [frontend/lib/api-hooks/use-auth-api.ts](../frontend/lib/api-hooks/use-auth-api.ts)
  - [frontend/lib/openapi/client.ts](../frontend/lib/openapi/client.ts)

つまり完了条件 4 項目のうち 3 項目はすでに満たされており、残作業は **「ファイル名 `cognito.ts` が実態と乖離している（Cognito を直接叩いていない）ため、責務に沿って分割・改名する」** という改名リファクタリングである。

### 1.2 スコープ（対象）

- `frontend/lib/cognito.ts` を責務単位で 2 ファイルに分割し削除する
- 既存 import 元（3 ファイル）の import パスを更新する
- 動作（API 呼び出し先・localStorage キー・イベント名）は **変更しない**

### 1.3 非対象

- バックエンド `/auth/*` API の仕様変更
- 認証フロー（ログイン・MFA・パスワードリセット）の挙動変更
- `localStorage` のトークン保管方式そのものの変更（Cookie 化等は別タスク）
- AuthContext / useAuthApi の責務分担の見直し（[docs/00_rules.md](00_rules.md) §3 既存方針に従う）

### 1.4 関連ドキュメント

- [docs/01_requirements.md](01_requirements.md) — 機能要件
- [docs/00_rules.md](00_rules.md) §3「API アクセスの分離」「AuthContext と useAuthApi の責務分担」
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証機能設計
- [docs/27_refresh-token-flow.md](27_refresh-token-flow.md) — refresh middleware 連携

## 2. 設計

### 2.1 現状の `frontend/lib/cognito.ts` の責務

| 責務カテゴリ | エクスポート |
| ---- | ---- |
| Auth API 呼び出し | `login`, `respondMfaChallenge`, `completeNewPassword`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `LoginResult`（型） |
| トークン/セッション管理 | `getAccessToken`, `refreshAccessToken`, `getCurrentUserEmail`, `setCurrentUserEmail`, `AUTH_CLEARED_EVENT` |

### 2.2 分割後の構成

```text
frontend/lib/
  api-hooks/
    use-auth-api.ts      ← Auth API 呼び出し関数群を内包（外向き I/F は現状維持）
  auth-session.ts        ← 新規。トークン/セッション管理ユーティリティ
```

#### 2.2.1 `frontend/lib/auth-session.ts`（新規）

ブラウザの `localStorage` を介したアクセストークン・リフレッシュトークン・メールアドレスの読み書き、および `refreshAccessToken` の実装（`/auth/refresh` 呼び出し）を集約する。`'use client'` 不要のプレーンモジュール。

公開 API（既存と完全同一シグネチャ）:

```ts
export const AUTH_CLEARED_EVENT: 'petal:auth-cleared';
export function getAccessToken(): Promise<string | null>;
export function refreshAccessToken(): Promise<string | null>;
export function getCurrentUserEmail(): string | null;
export function setCurrentUserEmail(email: string): void;
```

内部のみで使用するヘルパー（`persistSession` / `clearSession` / `isTokenExpired`）も同ファイルに同居し、Auth API 関数群からも呼べるようにする（後述）。

#### 2.2.2 `frontend/lib/api-hooks/use-auth-api.ts`（既存ファイルに統合）

現在は `@/lib/cognito` から re-export しているだけのフックを、自前で Auth API 関数を保持する形に変更する。各 API 関数は `auth-session.ts` の `persistSession` / `clearSession` を利用してトークンを保存する。

公開 API（現状維持）:

```ts
export function useAuthApi(): {
  login: (email, password) => Promise<LoginResult>;
  completeNewPassword: (email, newPassword, session) => Promise<void>;
  respondMfaChallenge: (email, code, session) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email) => Promise<void>;
  confirmPasswordReset: (email, code, newPassword) => Promise<void>;
};
export type LoginResult = …;
```

これにより [docs/00_rules.md](00_rules.md) §3「ページフックは `@/lib/cognito` を直接呼び出さない」のルール文面に登場する `@/lib/cognito` 自体が消え、ルール記述も整合する。

### 2.3 import の付け替え

| ファイル | 旧 import | 新 import |
| ---- | ---- | ---- |
| `frontend/contexts/AuthContext.tsx` | `AUTH_CLEARED_EVENT`, `getAccessToken`, `getCurrentUserEmail`, `setCurrentUserEmail` from `@/lib/cognito` | 同上 from `@/lib/auth-session` |
| `frontend/lib/api-hooks/use-auth-api.ts` | `login` 他 7 件 from `@/lib/cognito` | ファイル内で実装（自前定義）。`persistSession` / `clearSession` は `@/lib/auth-session` から import |
| `frontend/lib/openapi/client.ts` | `getAccessToken`, `refreshAccessToken` from `../cognito` | 同上 from `../auth-session` |

### 2.4 ルールとの整合性確認

- **オニオン依存方向**: フロント側はオニオン適用外（[docs/00_rules.md](00_rules.md) §1 はバックエンド向け）。違反なし。
- **API アクセスの分離（00_rules.md §3）**: `useAuthApi` に Auth API を完全に閉じ込めるため、本ルールにより整合する。
- **AuthContext と useAuthApi の責務分担**: `AuthContext` がトークン管理 util（`auth-session.ts`）を直接読むのは現状と変わらず、認証グローバル状態の初期化に必要なため許容範囲。
- **Zod / strict**: 既存コードに Zod 検証は導入されていないため踏襲（本タスクで新規導入はスコープ外）。

### 2.5 トランザクション境界

DB 操作はフロントエンド側のためなし。[docs/00_rules.md](00_rules.md) §4 該当なし。

### 2.6 セキュリティ

- `NEXT_PUBLIC_COGNITO_*` は既に未参照。誤って再導入しない。
- ブラウザに露出する値（`NEXT_PUBLIC_API_BASE_URL` のみ）は変更しない。
- localStorage キー（`petal_access_token` / `petal_refresh_token` / `petal_email`）は既存と完全同一を維持し、ユーザーセッションの破棄を起こさない。

## 3. 完了条件

- `frontend/lib/cognito.ts` が削除されている
- `frontend/lib/auth-session.ts` が追加され、トークン/セッション系の公開 API がそのシグネチャで提供される
- `frontend/lib/api-hooks/use-auth-api.ts` が Auth API 関数を自前で保持する構成になっている
- `frontend/contexts/AuthContext.tsx` / `frontend/lib/openapi/client.ts` の import が新パスに更新されている
- リポジトリ全体で `@/lib/cognito` および `../cognito` への参照が 0 件
- `pnpm --filter frontend build` が通る
- `pnpm --filter frontend lint` が通る
- `npx markdownlint-cli 'docs/**/*.md'` が通る
- 手動動作確認シナリオ（§4）がすべて通る

## 4. 手動動作確認シナリオ

ローカル（`NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` + ローカル NestJS バックエンド）で実施する。

- [ ] 既存セッションをクリアした状態で `/login` を開き、有効な認証情報でログインしてホームに遷移できる
- [ ] ログイン後、ページ遷移で 401 → 自動 refresh → リトライが正常に成功する（`openapi/client.ts` の middleware 経路）
- [ ] アクセストークンを localStorage から手動削除した状態で API を叩き、refresh により復旧する
- [ ] リフレッシュトークンを手動削除した状態で API を叩き、`AUTH_CLEARED_EVENT` が発火して未認証状態に戻る
- [ ] `/logout` 相当の操作で localStorage が全クリアされ、再度ログイン画面に遷移する
- [ ] パスワードリセット要求 → 確認の 2 ステップが UI から成功する（MFA 未設定ユーザー）
- [ ] MFA 設定ユーザーでログインし、MFA チャレンジ画面で認証コードを入力してログイン完了する
- [ ] 初回ログインユーザー（NEW_PASSWORD_REQUIRED）でパスワード設定画面に遷移し、新パスワード設定でログイン完了する
