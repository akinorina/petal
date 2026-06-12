# Petal - メールアドレス変更フロー 設計

対応タスク: **TSK-9「メールアドレス変更フロー」**

関連ドキュメント:

- [docs/03_workflow.md](03_workflow.md)
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md)
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md)
- [docs/19_password-reset.md](19_password-reset.md)

---

## 1. スコープと完了条件

### 対象

- **Backend**:
  - `PATCH /users/me/email` — ログイン中ユーザーのアクセストークンで Cognito の `UpdateUserAttributes` を呼び、新メールアドレスへ検証コードを送信する。
  - `POST /users/me/email/verify` — Cognito の `VerifyUserAttribute` でコードを確定し、DB の `users.email` も新値に更新する。
  - 新メールアドレスの DB 重複チェック（PATCH 時・verify 時の両方で実施）。
- **Frontend**:
  - `/me/email` ページを `(authenticated)` レイアウト下に新設（2 ステップ: 新メアド入力 → コード入力）。
  - サイドナビ／ヘッダーから当該ページへの導線を追加。

### 非対象

- 監査ログ／変更履歴の保持（別タスクへ委譲）。
- パスワード再入力による本人確認（アクセストークン保持で十分とみなす）。
- メール変更を契機にしたグローバルサインアウト／既存トークン失効（パスワード変更とは異なり、email 変更では既存セッションを維持する）。
- Admin 操作による他ユーザーの email 変更。

### 完了条件（Notion チケット転記）

- [ ] 一般ユーザーが email 変更を完走できる
- [ ] DB と Cognito の email が一致した状態になる
- [ ] 失敗・キャンセル時は元の email のまま残る

---

## 2. API 仕様

### 2.1 メールアドレス変更要求

```text
PATCH /users/me/email
Authorization: Bearer <access token>
Body: { "email": "new@example.com" }

Response 204 No Content

Errors:
  400 — email バリデーション失敗 / 現在の email と同一
  401 — 未ログイン
  409 — 新 email が他ユーザーで使用中（DB 上で重複）
  502 — Cognito 連携失敗
```

サーバ側処理:

1. リクエストの access token から `cognito_sub` を取り出し、対象ユーザーを特定。
2. 現在の email と同一な場合は 400 を返す。
3. DB 上で新 email を持つ別ユーザーが存在しないか確認（自分自身を除く）。存在すれば 409。
4. `UpdateUserAttributesCommand`（access token + `email` 属性）を呼び、新メアドへ検証コードを送る。
5. このとき Cognito 側で `email_verified=false` になり、`email` 属性は新値で保留状態になる。**DB の email はまだ更新しない**。

### 2.2 検証コード確認

```text
POST /users/me/email/verify
Authorization: Bearer <access token>
Body: { "code": "123456" }

Response 204 No Content

Errors:
  400 — 入力バリデーションエラー / 無効なコード / 期限切れ
  401 — 未ログイン
  409 — 確定直前の DB 重複再チェックで他ユーザーが新 email を使用していた
  502 — Cognito 連携失敗 / DB 更新失敗
```

サーバ側処理:

1. access token から対象ユーザーを特定。
2. `GetUserCommand` で Cognito 上の現状属性を取得し、保留中の新 email を読み出す（後述 §4.3）。
3. DB トランザクションを開始する。
4. トランザクション内で、新 email を持つ他ユーザーが存在しないか確認（自分自身を除く）。存在すれば 409 を返し、Cognito の `VerifyUserAttribute` は呼ばずにロールバック。
5. トランザクション内で `users.email` を新値に UPDATE する（**まだコミットしない**）。
6. `VerifyUserAttributeCommand`（access token, `email`, code）を呼ぶ。
   - 成功 → トランザクションを **コミット**。
   - 失敗（CodeMismatch / ExpiredCode / その他）→ トランザクションを **ロールバック**し、対応するエラー（400 / 502）を返す。

詳細は §3.2 を参照。

### 2.3 Zod スキーマ

```ts
export const RequestEmailChangeSchema = z.object({
  email: z.email(),
});

export const ConfirmEmailChangeSchema = z.object({
  code: z.string().min(1),
});
```

両エンドポイントとも認証必須（`@Public()` を付けない）。

---

## 3. シーケンス

```text
Frontend                         Backend                    Cognito                  DB
   │ /me/email へ遷移              │                          │                       │
   │                              │                          │                       │
   │ Step1: 新 email 入力 → 送信    │                          │                       │
   │  PATCH /users/me/email        │                          │                       │
   │─────────────────────────────>│ JwtAuthGuard で sub 確定  │                       │
   │                              │ DB 重複チェック            │──────────────────────>│
   │                              │                          │<───── ok ─────────────│
   │                              │ UpdateUserAttributes     │                       │
   │                              │ (email=新, AccessToken)  │                       │
   │                              │─────────────────────────>│                       │
   │                              │<──── ok ────────────────│                       │
   │<──── 204 ────────────────────│                          │                       │
   │                              │                          │                       │
   │                       検証メール: コード送信               │                       │
   │ Step2 へ遷移                                             │                       │
   │                                                         │                       │
   │ コード入力 → 送信                                          │                       │
   │  POST /users/me/email/verify  │                          │                       │
   │─────────────────────────────>│                          │                       │
   │                              │ GetUser で保留中 email を取得 ─────────────────>│
   │                              │<───── 新 email ──────────│                       │
   │                              │ BEGIN TX                 │──────────────────────>│
   │                              │ DB 重複再チェック         │──────────────────────>│
   │                              │                          │<───── ok ─────────────│
   │                              │ UPDATE users.email = 新   │──────────────────────>│
   │                              │ (未コミット)              │<───── ok ─────────────│
   │                              │ VerifyUserAttribute      │                       │
   │                              │ (email, code)            │                       │
   │                              │─────────────────────────>│                       │
   │                              │<──── ok ────────────────│                       │
   │                              │ COMMIT                   │──────────────────────>│
   │                              │<───── ok ────────────────────────────────────────│
   │<──── 204 ────────────────────│                          │                       │
   │                                                         │                       │
   │   失敗時: VerifyUserAttribute エラー → ROLLBACK                                    │
```

### 3.1 失敗時の挙動（重要）

| 段階 | 失敗 | サーバ応答 | DB／Cognito 整合性 |
| ---- | ---- | ---------- | -------------------- |
| PATCH `/users/me/email` | 入力バリデーション | 400 | 変更なし |
| PATCH `/users/me/email` | 現在 email と同一 | 400 | 変更なし |
| PATCH `/users/me/email` | DB 重複 | 409 | 変更なし |
| PATCH `/users/me/email` | UpdateUserAttributes 失敗 | 502 | 変更なし（DB 未更新、Cognito 未更新） |
| verify | CodeMismatch | 400 | DB UPDATE はロールバック。Cognito の保留 email も未確定のまま残る（再試行可能） |
| verify | ExpiredCode | 400 | DB UPDATE はロールバック。再度 PATCH からやり直し |
| verify | DB 重複再検出 | 409 | DB UPDATE 前に検出 → ロールバック。Cognito 未確定 |
| verify | DB UPDATE 失敗（一意制約違反等） | 409 / 502 | Cognito 未呼び出しのためロールバックで完全復元 |
| verify | VerifyUserAttribute 失敗（その他 SDK 例外） | 502 | ロールバック。Cognito も未確定 |
| verify | VerifyUserAttribute 成功 / COMMIT 失敗 | 502 | **DB と Cognito が乖離**（極小確率）。運用復旧（後述 §3.2） |
| verify | GetUser 失敗 | 502 | 変更なし |

### 3.2 トランザクション境界の設計（極力安全側）

email 変更は「DB と Cognito の両側を同時に変える」必要がある。両者は本来分散トランザクションを組めないが、操作順序とトランザクション境界を組み替えることで **不整合の発生確率をほぼゼロまで縮小** する。

採用方式: **DB を先に UPDATE してトランザクションを保留し、Cognito Verify の成否でコミット／ロールバックする**。

```text
BEGIN
  SELECT (FOR UPDATE) … 重複再チェック        -- 競合は行ロックで遮断
  UPDATE users SET email = 新 WHERE id = ?    -- まだ可視化されない
  ── ここで Cognito VerifyUserAttribute ──
    成功 → COMMIT         （DB 反映 = ユーザーから見て初めて新 email になる）
    失敗 → ROLLBACK       （DB は元 email のまま、Cognito も未確定）
END
```

#### 各失敗シナリオでの整合性

| 失敗箇所 | DB | Cognito | ユーザー観点 |
| -------- | -- | ------- | ------------ |
| 重複再チェックで他ユーザー検出 | ROLLBACK（変更なし） | 変更なし | 旧 email のまま、再試行を案内 |
| `UPDATE` で一意制約違反 | ROLLBACK（変更なし） | 変更なし | 旧 email のまま |
| `VerifyUserAttribute` 失敗 | ROLLBACK（変更なし） | 確定せず（保留 email は残るが再試行で上書き可） | 旧 email のまま |
| `VerifyUserAttribute` 成功 → `COMMIT` 失敗 | コミット失敗（旧 email のまま） | 新 email 確定 | **不整合**（極小確率） |

「Verify 成功直後の COMMIT が失敗する」ケースのみ不整合となるが、これは「DB セッションが Cognito 応答受信から COMMIT までの数 ms の間に切断される」非常に狭い窓に限定される。発生時の挙動:

- ログを ERROR で出し、`user_id` / `cognito_sub` / 旧 email / 新 email を残す。
- 502 を返してフロントは「変更が完了しなかった可能性があります。サポートに連絡してください」を表示。
- 復旧は運用手順（Cognito の `email` に合わせて DB の `users.email` を手動 UPDATE）。

#### 注意点

- トランザクションの保持時間が Cognito API のレイテンシ（〜数百 ms）分長くなる。`users` 行レベルロックが取られるが、自分の行のみが対象なので他リクエストへの実害は無い（admin による一覧取得等は `READ COMMITTED` のもとで未コミットの新 email を見ない）。
- TypeORM の `DataSource.transaction()`（または `QueryRunner`）でトランザクション境界を明示する。Service 層に薄い境界を作り、Repository は既存メソッドを再利用する。
- DB 重複再チェックは `FOR UPDATE` 相当のロックは取らない（対象は他ユーザーの行で `users.email` に UNIQUE 制約があるため、`UPDATE` 時に最終的に弾かれる）。重複再チェックは早期リターン（409）の最適化として残す。

#### 採用しなかった代替案

- **Cognito 先行 → 後追い DB UPDATE**: Cognito 成功後の DB 失敗で乖離が起きやすく、本要件「失敗・キャンセル時は元の email のまま残る」に反するため不採用。
- **Outbox パターン**: 厳密な事後整合性を実現できるが、テーブル追加・ワーカー導入が必要で本タスクのスコープを越える。将来的に「メール変更を含む複数の DB 永続化と外部副作用」が増えた段階で検討する。

### 3.3 同一 email への変更要求

PATCH 時に「現在の email と同一」を 400 で弾く。これは Cognito も同様の挙動だが、UI 文言を制御するためサーバ側で先に検出する。

### 3.4 キャンセル時の挙動

- ユーザーが Step2 へ進まずブラウザを閉じた場合、Cognito 側に「保留中の新 email」が残るが `email_verified=false` のため次回 PATCH で上書きされる。DB は元の email のまま。
- 既存トークンは失効しない（email 変更ではログインセッションを維持する）。

---

## 4. バックエンド実装

### 4.1 ファイル構成

| 操作 | パス | 内容 |
| ---- | ---- | ---- |
| 修正 | `backend/src/user/infra/cognito-user.client.ts` | `updateUserEmail(accessToken, newEmail)` / `verifyUserEmail(accessToken, code)` / `getPendingEmail(accessToken)` を追加 |
| 修正 | `backend/src/user/application/user.schemas.ts` | `RequestEmailChangeSchema` / `ConfirmEmailChangeSchema` を追加 |
| 修正 | `backend/src/user/application/user.service.ts` | `requestEmailChange(actor, newEmail, accessToken)` / `confirmEmailChange(actor, code, accessToken)` を追加 |
| 修正 | `backend/src/user/controller/user.controller.ts` | `PATCH /users/me/email` / `POST /users/me/email/verify` を追加 |
| 修正 | `backend/src/user/controller/user.dto.ts` | 入力 DTO を追加 |
| 修正 | `backend/src/user/domain/user.ts` | `email` を更新可能フィールドとして扱えるよう setter 化（既存 `name` 等と同等に） |

DB スキーマ・リポジトリ I/F は変更不要（`save(user)` で email 更新できる）。

### 4.2 認証ユーザーの取得

`JwtAuthGuard` が `request.user` に Cognito の `sub` を注入している。これを既存パターン（`@CurrentUser()` デコレーター等が無ければ `@Req()` から取り出し、`UserService.findByCognitoSub` で User を引く）で取得する。実装時に既存の自分自身参照箇所（あれば）に揃える。

### 4.3 Cognito 「保留中の新 email」の取り扱い

`UpdateUserAttributes` 後、Cognito 内部では:

- `email` 属性 = 新 email（ただし `email_verified=false`）

`GetUser` で取れる `email` 属性は新 email になっている。verify 直前の DB 重複チェックはこの値で行う。

> 注意: `email` 属性が new に上書きされ `email_verified=false` になっている期間中、ユーザーは引き続きアクセストークンが有効でログイン状態を維持できる。`AdminInitiateAuth`（パスワードログイン）は username = 旧 email で動作する（Cognito の username は不変、`email` はあくまで属性）。

### 4.4 SDK エラー判別

`CognitoUserClient` に追加する判別関数:

- `isCodeMismatch(err)` / `isExpiredCode(err)` … `CodeMismatchException` / `ExpiredCodeException`
- `isAliasExists(err)` … `AliasExistsException`（Cognito 側の email 重複検出。プールが email を alias にしている場合に発生）

---

## 5. フロントエンド実装

### 5.1 新規ページ `frontend/app/(authenticated)/me/email/page.tsx` + `use-me-email-page.ts`

ステート:

```ts
type Step =
  | { kind: 'request' }
  | { kind: 'confirm'; pendingEmail: string };
```

UI:

- Step `request`: 現 email を読み取り専用で表示。新 email 入力 + 「コードを送信」 → 成功で `confirm` に遷移し pendingEmail を保持。
- Step `confirm`: 「<新 email> 宛に送信したコードを入力してください」+ コード入力 + 「確定」 → 成功でフラッシュメッセージを出して `/me/email` を再読込（or `/users` 等へ遷移）。
- 「キャンセル」リンクで Step1 に戻る（バックエンドへの取り消し API は不要）。

### 5.2 ナビゲーション追加

`frontend/app/(authenticated)/layout.tsx` のヘッダー右側、メールアドレス表示部分をリンク化して `/me/email` へ遷移させる。

### 5.3 API クライアント

`frontend/lib/api-hooks/use-users-api.ts` に以下を追加（`/me` 系は users feature 配下と判断）:

- `requestEmailChange(email: string): Promise<void>` … `PATCH /users/me/email`
- `confirmEmailChange(code: string): Promise<void>` … `POST /users/me/email/verify`

`apiClient` の既存ラッパを利用し、`Authorization` ヘッダーは middleware で自動付与される既存パターンに従う。

### 5.4 AuthContext との連携

`AuthContext` がメモリに持つ `email` は変更後に更新する必要がある。verify 成功後、`AuthContext` のリロード手段（既存の me 取得 or 再ログイン強制）に従って email 表示を新値へ反映する。既存実装の作りに合わせて最小修正で済むようにする（実装計画 Step 2 で確定）。

---

## 6. テスト

自動テストは追加せず、手動動作確認を完了条件とする（既存方針）。

### 手動動作確認シナリオ

1. ログイン後 `/me/email` を開く → 現 email が表示される。
2. 自分宛に届くテスト用メアド（例: alias）を新 email に入力 → コード送信 → 受信。
3. コードを入力 → 成功 → 画面に新 email が反映される。
4. 一旦ログアウト → 新 email + パスワードでログイン成功。
5. 異常系: 同じ email に変更しようとすると 400。
6. 異常系: 別ユーザーが使用中の email で 409。
7. 異常系: 不正コードで 400、期限切れコードで 400。
8. 異常系: Step1 後に Step2 へ進まずブラウザを閉じても、再度 PATCH すれば別の新 email を上書き指定できる（DB は旧 email のまま）。

---

## 7. 既存ドキュメント・運用更新

### 7.1 `AGENTS.md`

ドキュメント表に `20_email-change-flow.md` を追記。

### 7.2 環境変数 / マイグレーション / IAM

- 環境変数: 変更なし。
- マイグレーション: 変更なし（DB スキーマ変更なし）。
- IAM: `cognito-idp:UpdateUserAttributes` / `cognito-idp:VerifyUserAttribute` / `cognito-idp:GetUser` は **access token ベースの API** であり、IAM 権限は不要（クライアントが SDK 経由で叩くが認可は token）。`AdminGetUser` を使う実装に切り替えた場合のみ IAM ポリシー追加が必要。今回は不要。

---

## 8. 完了条件チェックリスト

§1 と同じ。

---

## 9. 未確定事項 / 将来検討

- メール変更時の本人再認証（パスワード再入力）。現状アクセストークン保有で十分と判断。
- 監査ログによる email 変更履歴の保持（別タスク）。
- Admin が他ユーザーの email を強制変更する機能（運用要件が出た時点で別タスク）。
- DB UPDATE 失敗時の自動復旧（Outbox / Saga）。実害確率の低さから本タスクでは未対応。

---

## 10. 実装計画（Step 2）

### 10.1 変更・追加ファイル一覧

#### Backend

| 種別 | パス | 内容 |
| ---- | ---- | ---- |
| 修正 | `backend/src/user/domain/user.ts` | `email` を `readonly` から可変フィールドへ変更 |
| 修正 | `backend/src/user/infra/cognito-user.client.ts` | `updateUserEmail(accessToken, newEmail)` / `verifyUserEmail(accessToken, code)` / `getPendingEmail(accessToken)` を追加。`isCodeMismatch` / `isExpiredCode` / `isAliasExists` 判別関数を追加 |
| 修正 | `backend/src/user/application/user.schemas.ts` | `RequestEmailChangeSchema` / `ConfirmEmailChangeSchema` を追加 |
| 修正 | `backend/src/user/application/user.service.ts` | `requestEmailChange(actor, newEmail, accessToken)` / `confirmEmailChange(actor, code, accessToken)` を追加。`DataSource` を DI してトランザクション境界を実装 |
| 修正 | `backend/src/user/user.module.ts` | （DataSource は TypeOrmModule から自動 DI されるので追加変更なしの想定） |
| 修正 | `backend/src/user/controller/user.controller.ts` | `PATCH /users/me/email` / `POST /users/me/email/verify` を追加。`@Req()` から `extractCognitoSub` 相当で sub と access token を取り出す |
| 修正 | `backend/src/user/controller/user.dto.ts` | `RequestEmailChangeRequestDto` / `ConfirmEmailChangeRequestDto` を追加 |
| 生成 | `backend/openapi.json` | `pnpm --filter backend openapi:export` で更新 |

`extractBearerToken` 相当のロジックは [image.controller.ts](../backend/src/image/controller/image.controller.ts) に既存の `extractCognitoSub(req)` パターンがあるが、access token そのものは Cognito 呼び出しにも必要なため、`@Headers('authorization')` で別途取得する（`auth.controller.ts` の `logout` と同形）。

#### Frontend

| 種別 | パス | 内容 |
| ---- | ---- | ---- |
| 生成 | `frontend/lib/openapi/schema.d.ts` | `pnpm --filter frontend openapi:gen` で再生成 |
| 修正 | `frontend/lib/api.ts` | `userApi` に `requestEmailChange(email)` / `confirmEmailChange(code)` を追加 |
| 修正 | `frontend/lib/api-hooks/use-users-api.ts` | 既存 `useUsersApi` に `requestEmailChange` / `confirmEmailChange` を露出 |
| 新規 | `frontend/app/(authenticated)/me/email/page.tsx` | View 専用（フックを呼び JSX を return） |
| 新規 | `frontend/app/(authenticated)/me/email/use-me-email-page.ts` | `Step = { kind: 'request' } \| { kind: 'confirm'; pendingEmail }` ステート、API 呼び出し、エラーハンドリング |
| 修正 | `frontend/app/(authenticated)/layout.tsx` | ヘッダーの email 表示を `/me/email` への `<Link>` に変更 |
| 修正 | `frontend/lib/cognito.ts` | verify 成功後にローカルストレージの `EMAIL_KEY` を新値へ更新する `updateStoredEmail(newEmail)` を追加 |
| 修正 | `frontend/contexts/AuthContext.tsx` | `setEmail(newEmail)`（または `refreshEmail()`）を露出。verify 成功後にページフックから呼ぶ |

#### ドキュメント

| 種別 | パス | 内容 |
| ---- | ---- | ---- |
| 修正 | `AGENTS.md` | ドキュメント表に `20_email-change-flow.md` を追記（**Step 1 で対応済み**） |

### 10.2 必要な migration / 環境変数 / 依存追加

- migration: **不要**（`users.email` カラムは既存。UNIQUE 制約も既存）。
- 環境変数: **不要**。
- npm 依存: **不要**（`@aws-sdk/client-cognito-identity-provider` 既存。`UpdateUserAttributesCommand` / `VerifyUserAttributeCommand` / `GetUserCommand` を import 追加するのみ）。
- IAM: **不要**（access token ベースの API のため）。

### 10.3 作業順序と各ステップの完了確認方法

1. **Domain**: `User.email` を可変化 → `pnpm --filter backend build` 通過。
2. **Cognito client 拡張**: `updateUserEmail` / `verifyUserEmail` / `getPendingEmail` + 判別関数 → ビルド通過。
3. **Schemas / DTO**: Zod スキーマと DTO 追加 → ビルド通過。
4. **Service**: `requestEmailChange` / `confirmEmailChange` 実装。`DataSource.transaction()` でトランザクション境界 → ビルド通過。
5. **Controller**: 2 エンドポイント追加 → ビルド通過 + Swagger UI で `/users/me/email` 系が出ることを目視確認。
6. **OpenAPI export**: `pnpm --filter backend openapi:export` で `backend/openapi.json` 更新 → diff 確認。
7. **Frontend 型生成**: `pnpm --filter frontend openapi:gen` → `schema.d.ts` 更新 → diff 確認。
8. **Frontend API ラッパ**: `userApi` / `useUsersApi` に追加 → `pnpm --filter frontend build` 通過。
9. **Frontend ページ**: `/me/email` 新設 + ナビ修正 + AuthContext 連携 → ビルド通過。
10. **手動動作確認**: §6 のシナリオ 1〜8 をローカル環境で実行。
11. **Step 5 自主レビュー**: 設計整合・規約遵守・不要物チェック。

各ステップ完了後の主なコマンド:

```bash
pnpm --filter backend build
pnpm --filter backend openapi:export
pnpm --filter frontend openapi:gen
pnpm --filter frontend build
```

### 10.4 リスク・未確定事項

- **AuthContext の email 反映方法**: 現状 `getCurrentUserEmail()` が localStorage から読む実装。`updateStoredEmail` を追加して localStorage を更新 + `AuthContext` の state を `setEmail` で書き換える形に倒す予定。実装時に既存 API 形（`completeNewPassword` 後の state 更新パターン）に揃える。
- **Cognito User Pool の email alias 設定**: alias になっているとサーバ側 DB 重複検出より先に Cognito が `AliasExistsException` を返す可能性がある。`isAliasExists` を 409 にマップし、UI 文言を「他ユーザーが使用中」とする。
- **GetUser の SDK 例外**: `NotAuthorizedException`（access token 失効中）で 401 を返す扱いとする。
- **Admin による別ユーザーの email 変更**: 本タスクでは非対応。既存 `PATCH /users/:id` には `email` フィールドを **追加しない**（現 `UpdateUserSchema` に email を入れない）。
- **同一 email 重複検出のレース**: PATCH 時の事前チェックと verify 時の `UNIQUE` 制約で二重に弾く構造。極めて稀な競合は DB の一意制約違反 → 502/409 で拒否し、ユーザーには再試行を促す。

実装方針の承認が得られ次第 Step 3（ブランチ作成）に進む。
