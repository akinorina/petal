# 一般ユーザーは「ユーザー管理」「監査ログ」不可 設計（TSK-104）

## 0. 課題シート（Notion 転記）

> Notion タスク: [一般ユーザーは「ユーザー管理」「監査ログ」不可](https://app.notion.com/p/3749ca7d99dc805aaf81d5e0041c71fd)（TSK-104）

### 一行サマリ

ログイン後の画面で上部メニューの「ユーザー」「監査ログ」について、一般ユーザー（user）は使用不可とする。

### 背景・動機

ユーザーのロールには Admin（管理者）/ User（一般ユーザー）がある。Admin のみが「ユーザー管理」「監査ログ閲覧」ができるようにする。一般ユーザーが同 URL へアクセスした場合は権限外として扱う。

### 完了条件（原文）

- Admin ユーザーは「ユーザー」「監査ログ」の各画面へ遷移できる。
- 一般ユーザーは「ユーザー」「監査ログ」の各画面へ遷移できない。

### Phase 2 / 3 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 制御範囲 | **frontend のみ**。backend API は調査の結果すでに `@Roles(UserRole.Admin)` でガード済み（確認のみ・変更なし） |
| メニュー出し分け | 一般ユーザーには TopBar の「ユーザー」「監査ログ」メニュー自体を**非表示** |
| 直接 URL アクセス時 | **403**（権限がありません）を表示。当初 Notion では 404 だったが Phase 3 で 403 に変更 |
| role の取得・保持 | **AuthContext を拡張**。起動時・ログイン後に `GET /users/me` で role を取得し state 保持。`useAuth()` から参照 |
| 403 ゲートの実現 | **ネスト route group `(authenticated)/(admin-only)/`** を新設し `/users`・`/audit-logs` を移動。その layout で `role !== 'admin'` なら 403 を表示 |
| スコープ外 | backend のガード追加（既存で充足）／role を持たない他ページ（画像・/me 等）の挙動変更 |

---

## 1. 課題サマリ

ログイン後シェル（route group `(authenticated)`）の TopBar から、一般ユーザー（`role === 'user'`）に対して「ユーザー」「監査ログ」メニューを非表示にし、かつ `/users`・`/audit-logs` へ直接アクセスした場合は 403 を表示する。role は `GET /users/me` を唯一の取得源とし、`AuthContext` に保持して「メニュー出し分け」と「ページガード」の両方を同一ソースで判定する。backend API は既に admin 限定でガード済みのため変更しない。

## 2. スコープ

### 対象

- frontend: `AuthContext` を拡張し `role: UserRole | null` を保持（起動時・ログイン系成功時に `userApi.findMe()` で取得）。
- frontend: `(authenticated)/layout.tsx` の TopBar で「ユーザー」「監査ログ」NavLink を `role === 'admin'` のときのみ描画。
- frontend: ネスト route group `(authenticated)/(admin-only)/` を新設し、`users/`・`audit-logs/` ディレクトリを移動（URL は不変）。
- frontend: `(admin-only)/layout.tsx` で `role !== 'admin'` のとき 403 ビュー（`Forbidden403`）を表示。
- frontend: 403 ビュー用コンポーネント `Forbidden403` を新設（design-system の `EmptyState` を利用、トップ `/images` への導線付き）。

### 対象外

- backend のガード追加・変更。`AuditLogController` はクラスレベルで `@Roles(UserRole.Admin)`、`UserController` の `GET /users`・`GET /users/:id`・POST/PATCH/DELETE/restore/resend-invite はすべて `@Roles(UserRole.Admin)` 済み（一般ユーザーは 403）。本タスクでは**確認のみ**。
- 「画像」「/me（マイページ）」など全ユーザー共通ページの挙動。
- role 変更時のリアルタイム反映（再ログイン/リロードで反映される範囲で足りる）。
- middleware による SSR/エッジでのガード（トークンが localStorage 管理のため middleware から参照不可。クライアント側ガードで実現する）。

## 3. 制約

- 本ガードは **UX 上の制御**であり、機密の最終防衛線は backend の `@Roles` ガード（既存）。frontend のガードはそれを前提とする。
- オニオン/レイヤー規約はフロントには直接適用されないが、既存の「page.tsx は View・ロジックは `use-<page>-page.ts`」方針は維持する。今回ガードは layout（薄い分岐のみ）に置くため専用フックは不要。
- DB スキーマ変更なし・migration 不要・backend 変更なし・openapi 再生成不要。
- `role` の取得失敗時は `null` 扱いとし、**一般ユーザー相当（メニュー非表示・403）にフェイルセーフ**で倒す。

## 4. 設計判断ログ

### 判断 1: 権限外表示 → **403（採用） / 404（却下）**

- **採用**: 一般ユーザーが `/users`・`/audit-logs` に直接アクセスしたら「権限がありません」の 403 ビューを表示。
- **理由**: 社内向け管理ツールで「ユーザー管理」「監査ログ」という機能の存在を秘匿する価値が薄い（Admin にはメニューが見えている）。理由が明確で UX が素直。backend API が返す 403 とも意味が揃う。
- **却下**: 404（Not Found）。存在秘匿は本件では便益が薄く、「壊れたリンク」と誤解されうる。Notion 課題シート当初の 404 から Phase 3 で 403 に変更した。

### 判断 2: role の取得源 → **`GET /users/me`（採用）**

- login レスポンス（`{ accessToken, refreshToken, email }`）に role は含まれないため、`GET /users/me`（`UserResponseDto.role`）を唯一の取得源とする。
- **理由**: サーバを真実のソースにできる。localStorage に role を持たせる案は改竄/陳腐化リスクがあるうえ、UX 制御目的には findMe で十分。

### 判断 3: role の保持場所 → **AuthContext 拡張（採用） / 専用フック（却下）**

- **採用**: `AuthContext` の state に `role` を追加。`useAuth()` から参照。
- **理由**: メニュー出し分け（親 `(authenticated)/layout.tsx`）とページガード（`(admin-only)/layout.tsx`）が同一の単一ソースを共有でき、二重 fetch を避けられる。`(authenticated)/layout` は既に `useAuth()` を利用。
- **却下**: 専用フックで都度 findMe。メニューとガードで二重取得になり、ローディング整合も取りにくい。

### 判断 4: 403 ゲートの実現 → **ネスト route group の layout（採用）**

- **採用**: `(authenticated)/(admin-only)/layout.tsx` を新設し `/users`・`/audit-logs` を配下に移動。layout で role を判定し 403 を出す。route group はパスに影響しないため URL は不変。
- **理由**: 両ルートを 1 箇所でガードでき（DRY）、将来の admin 専用ページもグループに足すだけ。既存の `(authenticated)` route group 方針に沿う。
- **却下**: 各 `use-*-page` フックで判定（ルートごとに重複）／共有 `<RequireAdmin>` ラッパー（各 page.tsx に記述が要りラップ漏れリスク）。

### 判断 5: ローディング中のちらつき防止 → **AuthContext の `isLoading` で role 取得完了まで待つ（採用）**

- 起動時は token 確認後に findMe を await し、role が確定してから `isLoading=false` にする。`(authenticated)/layout` は `isLoading` 中「読み込み中...」を表示するため、admin メニューや本文が一瞬見えてから消える事象を防ぐ。
- クライアント遷移時は role が既に context にあるため即時判定。

## 5. データモデル

DB スキーマ変更なし（migration 不要）。frontend の `AuthState` に `role: UserRole | null` を追加するのみ。

## 6. API 仕様

backend の API 変更なし。既存 `GET /users/me`（`UserResponseDto` に `role: 'admin' | 'user'`）を frontend が利用するのみ。

## 7. フロントエンド挙動

### 7.1 AuthContext（`src/contexts/AuthContext.tsx`）

- `AuthState` に `role: UserRole | null` を追加。
- 起動 `useEffect`: `getAccessToken()` 後、token があれば `userApi.findMe()` を呼び `role` を取得。失敗時は `role = null`。token 無しは `role = null`。role 確定後に `isLoading = false`。
- `login` / `completeNewPassword` / `respondMfaChallenge` 成功時: `userApi.findMe()` で role を取得して state にセット（失敗時 `null`）。
- `logout` / `AUTH_CLEARED_EVENT`: `role = null`。
- 取得処理は内部ヘルパ `fetchRole(): Promise<UserRole | null>`（findMe → role、失敗時 null）に集約。

### 7.2 TopBar メニュー出し分け（`src/app/(authenticated)/layout.tsx` + `use-admin-layout.ts`）

- `use-admin-layout` が `useAuth()` から `role` を返す。
- 「ユーザー」「監査ログ」の `NavLink` を `role === 'admin'` のときのみ描画。「画像」「{email}（/me）」「ログアウト」は従来通り常時表示。

### 7.3 admin-only ガード（`src/app/(authenticated)/(admin-only)/layout.tsx`・新規）

- `'use client'`。`useAuth()` から `role` / `isLoading` を取得。
- `isLoading` 中は `null`（親 `(authenticated)/layout` が「読み込み中...」を表示しているため二重表示しない）。
- `role !== 'admin'` → `<Forbidden403 />` を返す。
- それ以外 → `children` をそのまま描画。

### 7.4 Forbidden403 ビュー（`src/app/(authenticated)/(admin-only)/Forbidden403.tsx`・新規）

- design-system の `EmptyState` を用い、「アクセス権限がありません」＋「このページを表示する権限がありません。」＋トップ（`/images`）への導線を表示。
- 親 `(authenticated)/layout` の `<main>` 内に描画されるため、TopBar（admin メニュー非表示版）は表示されたまま本文に 403 が出る。

### 7.5 ディレクトリ移動

- `src/app/(authenticated)/users/` → `src/app/(authenticated)/(admin-only)/users/`
- `src/app/(authenticated)/audit-logs/` → `src/app/(authenticated)/(admin-only)/audit-logs/`
- URL（`/users`・`/audit-logs`）は route group のため不変。`/images`・`/me`・`/images/[id]` は `(authenticated)` 直下のまま。

## 8. トランザクション境界

DB 書き込みなし・外部副作用なしのため対象外。

## 9. 既存設計との差分

- [docs/21_role-cognito-group-sync.md](21_role-cognito-group-sync.md)（TSK-10）で確立した「`GET /users/me` が role を返す」「backend は `@Roles` でガード」を**フロント側で利用**する初のケース。backend ロジックは不変。
- `AuthContext` がこれまで `email` / `isAuthenticated` のみ保持していたところに `role` を追加。
- route group `(authenticated)` 配下に `(admin-only)` を 1 段追加。

## 10. 完了条件（具体化）

- [ ] Admin でログイン時、TopBar に「画像／ユーザー／監査ログ」が表示され、`/users`・`/audit-logs` に遷移して各画面が表示される。
- [ ] 一般ユーザーでログイン時、TopBar に「ユーザー」「監査ログ」が**表示されない**（「画像」と email/ログアウトのみ）。
- [ ] 一般ユーザーで `/users` に直接アクセス → 403 ビュー（「アクセス権限がありません」＋トップ導線）が表示される。
- [ ] 一般ユーザーで `/audit-logs` に直接アクセス → 同上 403 ビュー。
- [ ] ローディング中に admin メニュー・本文が一瞬見えてから消えるちらつきがない。
- [ ] `cd frontend && pnpm lint` / `cd frontend && pnpm build` が通る。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 11. 手動動作確認シナリオ

Admin の確認:

1. admin アカウントでログイン。
2. TopBar に「画像／ユーザー／監査ログ」が並ぶ。
3. 「ユーザー」「監査ログ」をクリック → 各画面が表示される。
4. `/users`・`/audit-logs` に直接 URL アクセス → 各画面が表示される。

一般ユーザーの確認:

1. user ロールのアカウントでログイン。
2. TopBar に「ユーザー」「監査ログ」が**無い**（「画像」と email/ログアウトのみ）。
3. ブラウザのアドレスバーに `/users` を直接入力 → 403「アクセス権限がありません」＋トップ導線が表示される。
4. `/audit-logs` も同様に 403。
5. 「画像」「/me」は従来通り利用できる。

リロード/ちらつきの確認:

1. admin で `/users` を開いた状態でリロード → 「読み込み中...」の後に一覧が出る（admin メニューが先に見えて消える等がない）。
2. user で `/users` を開いた状態でリロード → 「読み込み中...」の後に 403（一覧が一瞬見えない）。

## 12. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定）。

---

## 13. 実装計画（Phase 4）

### 13.1 変更・追加ファイル（frontend のみ）

- `src/contexts/AuthContext.tsx`（変更）:
  - `type UserRole = Schemas['UserRole']`（`@/lib/openapi/client` の `Schemas`）を利用。
  - `AuthState` に `role: UserRole | null` を追加。
  - モジュールスコープに `async function fetchRole(): Promise<UserRole | null>`（`userApi.findMe()` の `role`、失敗時 `null`）を追加。
  - 起動 `useEffect`: token あり → `fetchRole()` を await して role を含めて `setState`、token 無し → `role: null`。
  - `login` / `completeNewPassword` / `respondMfaChallenge` 成功時: `fetchRole()` を await して `role` をセット。
  - `logout` / `AUTH_CLEARED_EVENT` ハンドラ: `role: null`。
  - `updateEmail` は `setState((prev) => ...)` で role を保持（変更なし）。
- `src/app/(authenticated)/use-admin-layout.ts`（変更）: `useAuth()` から `role` を取り出し返却に追加。
- `src/app/(authenticated)/layout.tsx`（変更）: `useAdminLayout()` から `role` を受け取り、「ユーザー」「監査ログ」の `NavLink` を `role === 'admin'` のときのみ描画。「画像」「email/ログアウト」は常時表示。
- `src/app/(authenticated)/(admin-only)/layout.tsx`（新規）: `'use client'`。`useAuth()` の `role` / `isLoading` で分岐。`isLoading` → `null`、`role !== 'admin'` → `<Forbidden403 />`、それ以外 → `children`。
- `src/app/(authenticated)/(admin-only)/Forbidden403.tsx`（新規）: design-system `EmptyState`（title「アクセス権限がありません」/ description「このページを表示する権限がありません。」/ `primaryAction` = `next/link` の `/images` 導線 `ds-link` スタイル）。
- ディレクトリ移動（`git mv`、URL 不変・相対 import は同梱移動で不変）:
  - `src/app/(authenticated)/users/` → `src/app/(authenticated)/(admin-only)/users/`
  - `src/app/(authenticated)/audit-logs/` → `src/app/(authenticated)/(admin-only)/audit-logs/`

migration / 依存追加 / 環境変数: **不要**。backend 変更・openapi 再生成: **不要**。

### 13.2 作業順序（コミット単位）

1. **AuthContext に role 保持を追加**（`fetchRole` + state/context 拡張）— 完了確認 `cd frontend && pnpm lint && pnpm build`
2. **TopBar メニュー出し分け**（`use-admin-layout.ts` + `layout.tsx`）— 完了確認 `cd frontend && pnpm lint && pnpm build`
3. **403 ガード**（route group `(admin-only)` 新設・`layout.tsx`・`Forbidden403.tsx`・`users`/`audit-logs` を `git mv`）— 完了確認 `cd frontend && pnpm lint && pnpm build`、`/users`・`/audit-logs` の URL が不変
4. **docs（本 §13）反映**— 完了確認 `npx markdownlint-cli 'docs/**/*.md'`

### 13.3 テスト方針

- frontend はユニットテスト無し（既存方針）。`pnpm lint` / `pnpm build` で型・ビルドを担保。
- 機能確認は §11 の手動シナリオ（Admin / 一般 / ちらつき）を実機で実施。

### 13.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 403 ビューの文言・見た目、`fetchRole` 失敗時フォールバック（`null` 固定）、`NavLink` 出し分けの JSX 構造、ローディング表示の細部。
- **中断して相談**:
  - role の取得源を `GET /users/me` 以外に変える必要が出た場合
  - role を localStorage 等に永続化する必要が出た場合（改竄/陳腐化の論点）
  - 403 を 404 に戻す/別ステータスにする必要が出た場合
  - route group 方式を諦め別アーキテクチャ（middleware 等）に変える必要が出た場合
  - backend のガード追加が必要だと判明した場合（既存で充足の前提が崩れる）

### 13.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | frontend の `UserRole` 型源 | `Schemas['UserRole']`（`@/lib/openapi/client`）。`'admin' \| 'user'` |
| 2 | `fetchRole` の配置 | モジュールスコープの純関数。`userApi.findMe()` → `role`、例外時 `null` |
| 3 | role 取得タイミング | 起動時 + login/completeNewPassword/respondMfaChallenge 成功時。await してから `setState`（ちらつき防止） |
| 4 | ローディング整合 | role 確定まで `isLoading=true`。`(authenticated)/layout` の「読み込み中...」で吸収。`(admin-only)/layout` は `isLoading` 中 `null` |
| 5 | 取得失敗時の扱い | `role=null` → 一般ユーザー相当（メニュー非表示・403）にフェイルセーフ |
| 6 | 403 ビューの導線 | `EmptyState` + `next/link` で `/images` へ（`ds-link` スタイル、TopBar と同様） |
| 7 | ディレクトリ移動の影響 | `git mv` で履歴保持。相対 import（`./use-*-page`）は同梱移動で不変、`@/` 絶対 import も不変。URL も route group のため不変 |
| 8 | `updateEmail` での role 保持 | `setState((prev) => ({ ...prev, email }))` のため role は維持 |
| 9 | backend 変更要否 | 不要（`@Roles(Admin)` 既存）。openapi 再生成も不要 |
