# Petal - ユーザー管理機能 拡張 設計

対応タスク: **TSK-4「ユーザー管理機能を充実」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — ユーザー情報・認証 設計（本書で一部更新）
- [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) — Cognito User Pool 構築手順

---

## 1. スコープと完了条件

### 対象

1. ユーザーの新規登録 API（Cognito 登録も同 API 内で行う）
2. ユーザーの削除 API（DB は softDelete、Cognito は **無効化**）
3. 上記に伴うフロントエンド改修
   - ユーザー登録モーダルから `cognitoSub` 入力を排し、`email` を受け取る
   - ユーザー一覧で `email` を表示
   - 初回ログイン時のパスワード変更フロー UI

### 非対象

- セルフサービスのサインアップ（[11_](11_user-info_and_authentication.md) §4.1 通り v1.1 以降）
- パスワードリセット
- メールアドレス変更フロー
- 削除済みユーザーの復活（再有効化）API（運用ニーズが出たら別タスク）

### 完了条件（Notion チケット転記＋細分化）

- [ ] **新規登録 API**
  - [ ] `POST /users` で `email` / `name` / `nameKana` / `role` を入力として受け取る（`cognitoSub` は受けない）
  - [ ] 同 API 内で Cognito にユーザーを作成し、`sub` を取得して DB に保存する
  - [ ] Cognito から招待メール（メールアドレス + 一時パスワード）が送信される
  - [ ] DB の `users.email` カラムに email が保存される
- [ ] **削除 API**
  - [ ] `DELETE /users/:id` で DB を softDelete する
  - [ ] 同 API 内で Cognito 上のユーザーを **無効化（AdminDisableUser）** する。**削除はしない。**
  - [ ] 既に Cognito 側が無効/不在でも 2xx を返す（冪等）
- [ ] **初回ログイン**
  - [ ] `POST /auth/login` が `NEW_PASSWORD_REQUIRED` チャレンジを検知して、フロントへ伝える
  - [ ] `POST /auth/challenge/new-password` で新パスワードを設定し、トークンを返す
  - [ ] フロントエンドに「新しいパスワードを設定」フォームがある
- [ ] **DB マイグレーション**
  - [ ] `users.email` カラムを追加する migration が追加されている
- [ ] **ドキュメント反映**
  - [ ] `docs/11_user-info_and_authentication.md` の email 取り扱い・初回ログインフローを更新
  - [ ] `.env.example` に変更がある場合は更新

---

## 2. 既存実装の現状（差分把握用）

| 項目 | 現状 | 本タスクでの変更 |
| ---- | ---- | ---------------- |
| `POST /users` | `cognitoSub` を入力に取り、DB INSERT のみ | `email` を入力に取り、Cognito 登録 + DB INSERT |
| `DELETE /users/:id` | DB softDelete のみ | Cognito `AdminDisableUser` を併せて実行 |
| `users` テーブル | `email` カラムなし | `email VARCHAR(255) NOT NULL UNIQUE` を追加 |
| `User` ドメイン | `email` フィールドなし | `email` を追加 |
| `auth/login` | `USER_PASSWORD_AUTH` のみ。チャレンジ未対応 | `NEW_PASSWORD_REQUIRED` チャレンジを検知して返す |
| `auth/challenge/new-password` | 存在しない | 新規実装 |
| Cognito 連携 | `auth/infra/cognito-auth.client.ts`（認証のみ） | `user/infra/cognito-user.client.ts` を新規追加（管理操作） |
| Frontend ユーザー追加モーダル | `cognitoSub` 入力欄あり | 削除し `email` 入力に置換 |
| Frontend ログイン | パスワード変更分岐なし | チャレンジ時にパスワード変更フォームを表示 |

---

## 3. 設計方針

### 3.1 責務分担

- **Cognito**: 認証情報の正（パスワード、`sub`、有効/無効状態）
- **Petal DB**: アプリ固有メタ（氏名、ふりがな、ロール）+ 表示用 email キャッシュの正
- DB と Cognito は `cognito_sub` で 1:1 連結する

### 3.2 email の保管

- `users.email` を追加。Cognito 招待時に確定した email をそのまま保存する。
- email の更新は本タスクの対象外（メールアドレス変更フローは別タスク）。
- 一意制約（`UNIQUE`）を付ける。Cognito 側でも email が unique attribute なので整合する。

### 3.3 外部 SDK の隔離（[00_rules.md](00_rules.md) §3）

- 既存の `auth/infra/cognito-auth.client.ts` は **認証用フロー** に閉じる。
- ユーザー管理用の Cognito 操作（`AdminCreateUser` / `AdminDisableUser` / `AdminRespondToAuthChallenge` など）は新規に分離して置く：
  - `backend/src/user/infra/cognito-user.client.ts` — `AdminCreateUser`, `AdminDisableUser`, `AdminGetUser`
  - `backend/src/auth/infra/cognito-auth.client.ts` — 既存の認証フロー + `AdminRespondToAuthChallenge`（チャレンジ応答は認証文脈なので auth 側に置く）
- `application/` の Service からは SDK を直接触らない。infra 経由のみ。

### 3.4 トランザクション境界

新規登録は「Cognito 作成 → DB INSERT」の 2 ステップ。**両者を厳密にアトミックにすることはできない**ため、補償ロジックを以下で扱う：

- Cognito 作成 → DB INSERT 失敗時:
  - ログに sub と email を記録
  - Cognito 側ユーザーを `AdminDeleteUser` で削除（**まだログイン可能になっていない / 招待状態 = `FORCE_CHANGE_PASSWORD`** の段階なので削除可。本ルール「Cognito 上では削除はしない」は **本登録済みユーザー** に対する規定であり、登録途中の補償用削除は許容する）
  - 失敗時のリトライ可能性を担保（再度 `POST /users` できる状態に戻す）
- Cognito 作成失敗時: DB は何も触らないので追加処理不要

削除は「DB softDelete → Cognito Disable」の順で行い、Cognito 側だけ失敗した場合は **DB は復元せず**、ログ＆エラー応答を返す（運用で再実行できる API を提供するか、再 `DELETE` を冪等にする）。本タスクでは **再 `DELETE` の冪等性で吸収** とする：DB が既に softDelete 済みでも Cognito Disable は再試行する。

---

## 4. ユーザー新規登録（POST /users 改修）

### 4.1 API 仕様

```text
POST /users
Authorization: Bearer <admin token>
Content-Type: application/json

Request:
{
  "email":    "user@example.com",
  "name":     "山田 太郎",
  "nameKana": "ヤマダ タロウ",
  "role":     "user" | "admin"   // optional, default "user"
}

Response 201:
{
  "id":        "uuid",
  "email":     "user@example.com",
  "cognitoSub": "uuid",
  "name":      "山田 太郎",
  "nameKana":  "ヤマダ タロウ",
  "role":      "user",
  "createdAt": "...",
  "updatedAt": "...",
  "deletedAt": null
}

Errors:
  400 — 入力バリデーションエラー
  409 — email がすでに登録済み
  502 — Cognito 連携エラー
```

入力 Zod スキーマ:

```ts
export const CreateUserSchema = z.object({
  email:    z.email(),
  name:     z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role:     z.enum(UserRole).default(UserRole.User),
});
```

### 4.2 シーケンス

```text
Frontend                Backend                Cognito         PostgreSQL
   │                       │                      │                │
   │  POST /users          │                      │                │
   │ {email,name,kana,role}│                      │                │
   │──────────────────────>│                      │                │
   │                       │ Zod parse            │                │
   │                       │ findByEmail() → 未登録                │
   │                       │──────────────────────────────────────>│
   │                       │<──────────────────────────────────────│
   │                       │ AdminCreateUser      │                │
   │                       │  (email + 招待メール送信)             │
   │                       │─────────────────────>│                │
   │                       │<─ sub ───────────────│                │
   │                       │ INSERT users         │                │
   │                       │  (sub, email, ...)   │                │
   │                       │──────────────────────────────────────>│
   │                       │  失敗時 → AdminDeleteUser で補償      │
   │<── 201 UserResponse ──│                      │                │
   │                       │                      │                │
                                                  │ 招待メール
                                                  │ → user@example.com
                                                  │ （一時パスワード）
```

### 4.3 一時パスワードの配送

- `AdminCreateUser` で `TemporaryPassword` を **指定しない**（Cognito が自動生成）。
- `MessageAction` は **指定しない**（デフォルト = 招待メールを送る）。
- Cognito の招待メールテンプレに email + 一時パスワードを含めるよう [14_](14_cognito-user-pool-setup.md) §3.9 で設定済み。
- 結果、ユーザーは email で招待メールを受け取り、初回ログイン時に新パスワードを設定する（§6）。

### 4.4 バリデーション・重複

- DB 側 `email` UNIQUE で防衛。Service では事前に `findByEmail` で 409 を判定（ユーザー向けに分かりやすいエラー）。
- Cognito 側でも email は unique attribute。万一 DB を介さず重複した場合は SDK 例外を 409 に変換する。

---

## 5. ユーザー削除（DELETE /users/:id 改修）

### 5.1 API 仕様

```text
DELETE /users/:id
Authorization: Bearer <admin token>

Response: 204 No Content

Errors:
  404 — id が存在しない、または既に削除済み
  502 — Cognito 連携エラー
```

### 5.2 シーケンス

```text
Frontend            Backend             Cognito        PostgreSQL
   │  DELETE /users/:id │                   │              │
   │───────────────────>│                   │              │
   │                    │ findById          │              │
   │                    │──────────────────────────────────>│
   │                    │<──── user ────────────────────────│
   │                    │ softDelete        │              │
   │                    │──────────────────────────────────>│
   │                    │ AdminDisableUser  │              │
   │                    │  (Username = email or sub)        │
   │                    │──────────────────>│              │
   │                    │<── ok / not-found │              │
   │<── 204 ────────────│                   │              │
```

### 5.3 冪等性・部分失敗

- 既に softDelete 済み: 404 を返す（再 DELETE を許容したい場合は将来検討）。
- Cognito 側で `UserNotFoundException`: 例外を握りつぶして 204（DB のみ削除されている状態は「削除完了」とみなす）。
- Cognito 側でその他例外: 502 を返す。DB はすでに softDelete 済み。**再 DELETE で 404 になり Cognito を再無効化できなくなる**ため、削除前に Cognito Disable を試行 → 成功してから DB softDelete に変更してもよいが、Cognito Disable のみ成功して DB に残ると別ユーザーが新規作成できてしまう懸念がある。
- **本タスクの方針**: 順序は **DB softDelete → Cognito Disable** とし、Cognito 失敗時は **502 を返しつつ DB は softDelete された状態にする**。運用復旧は手動 / 専用スクリプトで対応（運用ドキュメントに記載）。

### 5.4 Cognito Username の扱い

`AdminDisableUser` の `Username` は Cognito 側のユーザー名識別子で、本 User Pool は email サインインなので email を使う。`sub` でもよいが、SDK は文字列キーを Username にマップするので **email を渡す方が安定**。DB 側に email を保持しているので参照可能。

---

## 6. 初回ログイン（NEW_PASSWORD_REQUIRED）対応

### 6.1 ログイン API の拡張

```text
POST /auth/login
Body: { email, password }

成功（既存）:
{
  "status": "AUTHENTICATED",
  "accessToken": "...",
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "email": "..."
}

チャレンジ（新規）:
{
  "status": "CHALLENGE",
  "challengeName": "NEW_PASSWORD_REQUIRED",
  "session": "...",
  "email": "..."
}
```

レスポンスを **discriminated union** とし、フロントは `status` で分岐する。

### 6.2 新規エンドポイント

```text
POST /auth/challenge/new-password
Body:
{
  "email":       "user@example.com",
  "newPassword": "NewPassword123!",
  "session":     "<前段で受け取った session>"
}

Response 200:
{
  "status": "AUTHENTICATED",
  "accessToken": "...",
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "email": "..."
}

Errors:
  400 — パスワードポリシー違反 / 入力不備
  401 — session 不正・期限切れ
```

### 6.3 シーケンス

```text
Frontend                  Backend                 Cognito
   │  POST /auth/login          │                      │
   │ (email, tempPassword)      │                      │
   │───────────────────────────>│                      │
   │                            │ AdminInitiateAuth    │
   │                            │  USER_PASSWORD_AUTH  │
   │                            │─────────────────────>│
   │                            │<── ChallengeName=    │
   │                            │   NEW_PASSWORD_REQUIRED
   │                            │   + Session          │
   │<── { status: "CHALLENGE",  │                      │
   │      session, email } ─────│                      │
   │                            │                      │
   │ [パスワード変更フォーム表示]│                      │
   │                            │                      │
   │ POST /auth/challenge/      │                      │
   │   new-password             │                      │
   │ (email, newPassword,       │                      │
   │  session)                  │                      │
   │───────────────────────────>│                      │
   │                            │ AdminRespondToAuth   │
   │                            │  Challenge           │
   │                            │  NEW_PASSWORD        │
   │                            │─────────────────────>│
   │                            │<── AuthenticationResult
   │<── { status:               │   (tokens)           │
   │   "AUTHENTICATED", ... } ──│                      │
```

### 6.4 SECRET_HASH の扱い

`AdminInitiateAuth` / `AdminRespondToAuthChallenge` の両方で `SECRET_HASH` を計算して送る（既存 `cognito-auth.client.ts` のロジックを踏襲）。

### 6.5 認証フローの変更

現状の `USER_PASSWORD_AUTH` は **クライアントから直接** 使うフロー。SECRET_HASH 付きで動作するが、`AdminInitiateAuth` + `ADMIN_USER_PASSWORD_AUTH` のほうがチャレンジ応答との整合がよい。本タスクで **`AdminInitiateAuth` + `ADMIN_USER_PASSWORD_AUTH`** に揃える。User Pool 側で `ALLOW_ADMIN_USER_PASSWORD_AUTH` を有効化する（[14_](14_cognito-user-pool-setup.md) §3.10 で既に記載済み）。

---

## 7. フロントエンド改修

### 7.1 ユーザー追加モーダル

- 入力欄を `cognitoSub` → `email` に置換。ラベルを「メールアドレス」に修正。
- バリデーション: `type="email"` + `required`。
- 登録成功時、画面に「招待メールを送信しました」のトーストを表示する（任意）。

### 7.2 ユーザー一覧

- 列名を「メールアドレス」に統一し、`user.email` を表示する（型再生成後）。

### 7.3 ログイン画面

- `useAuth().login()` の戻り値を拡張：成功 / チャレンジ の判別。
- チャレンジを受けたら **同じ画面内** で「新しいパスワード」「新しいパスワード（確認）」のフォームに切り替え、確定で `POST /auth/challenge/new-password` を呼ぶ。
- 成功したら通常ログイン後と同じく `/users` へ遷移。

### 7.4 トークン保管

- 既存 `localStorage` 保管ロジック（`frontend/lib/cognito.ts`）はそのまま。
- チャレンジ完了で受け取ったトークンも同じ経路で保存する。

---

## 8. データモデル / マイグレーション

### 8.1 users テーブル更新

```sql
ALTER TABLE "petal"."users"
  ADD COLUMN "email" VARCHAR(255);

ALTER TABLE "petal"."users"
  ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
```

DB 制約としては **NULL 許容 + UNIQUE のみ** とする。NOT NULL 担保はアプリ層（Zod スキーマ・TypeORM カラム定義）で行う。理由：

- 既存環境にすでにレコードがある状態で `NOT NULL` に直接昇格させると失敗する
- 既存 admin の email バックフィルはマイグレーション外（create-admin 再実行 / 手動 UPDATE）で行う方針
- アプリ層は新規 INSERT 時に必ず email を入れるため、NULL のレコードが新規発生することはない

### 8.2 ドメインエンティティ更新

```ts
export const UserSchema = z.object({
  id: z.uuid(),
  cognitoSub: z.string().min(1),
  email: z.email(),                  // ← 追加
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.enum(UserRole),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
```

### 8.3 リポジトリ IF 更新

```ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByCognitoSub(cognitoSub: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;   // ← 追加
  findAll(): Promise<User[]>;
  save(user: User): Promise<User>;
  softDelete(id: string): Promise<void>;
}
```

### 8.4 create-admin スクリプト改修

- email を `users.email` にも INSERT する。
- 既存環境への影響: Local の DB を一度クリアして再実行する想定（運用ドキュメントに明記）。

---

## 9. 環境変数 / IAM 権限

### 9.1 環境変数

新規追加なし（既存 `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` を流用）。

### 9.2 IAM 権限

[14_](14_cognito-user-pool-setup.md) §5 に記載のうち、本タスクで実際に使うのは:

- `cognito-idp:AdminCreateUser`
- `cognito-idp:AdminDisableUser`
- `cognito-idp:AdminInitiateAuth`
- `cognito-idp:AdminRespondToAuthChallenge`
- `cognito-idp:AdminDeleteUser`（補償用）
- `cognito-idp:AdminGetUser`（debug / 既存ユーザー判定用、利用可能性を残す）

---

## 10. 既存ドキュメントの更新範囲

### 10.1 `docs/11_user-info_and_authentication.md`

- §2.1 属性表に `email` を追加（管理場所: PostgreSQL + Cognito、Cognito を正、DB はキャッシュ）
- §2.2 DB スキーマ SQL に `email VARCHAR(255) NOT NULL UNIQUE` を追加
- §4.1 v1 スコープ表に「管理者によるユーザー登録」「管理者によるユーザー削除」「初回パスワード設定」を ○ で追加
- §6 「初期 Admin ユーザー作成」セクションに、create-admin スクリプトが email も保存することを追記

### 10.2 `AGENTS.md`

- ドキュメント表に `15_user-management-enhancement.md` を追記。

### 10.3 `.env.example`

- 変更なし（既存変数で足りる）。

---

## 11. 完了条件チェックリスト

§1 と同じ。実装完了時にすべてチェックを埋める。

---

## 12. 未確定事項 / 将来検討

- 削除済みユーザーの **再有効化 API**（運用ニーズが出たら別タスク）。
- パスワードリセット（`ForgotPassword` / `ConfirmForgotPassword`）。
- メールアドレス変更フロー（Cognito の email 検証ステップを伴う）。
- ロール変更時の Cognito 側 attribute 反映（現状ロールは DB のみで管理。Cognito の `cognito:groups` を使う運用にする場合は別タスク）。
- 初回ログイン時のパスワードポリシーをフロントでも事前検証するか（現状は Cognito 側のエラーメッセージを表示するのみ）。
