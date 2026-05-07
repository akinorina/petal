# ユーザー情報と認証機能 - 設計書

## 1. 概要

v1（MVP）では **Admin ユーザー1名のみ** でシステムを稼働させる。
一般ユーザーのサインアップ・メール確認・パスワードリセットは v1.1 以降に実装する。
システムの内部構造は、はじめから複数ユーザーが存在する前提で設計する。

---

## 2. ユーザーエンティティ

### 2.1 属性と管理場所

| 属性 | 管理場所 | 備考 |
| ---- | -------- | ---- |
| メールアドレス | AWS Cognito（正） + PostgreSQL（キャッシュ） | ログイン ID として使用。Cognito が正で、表示・検索用に DB にもコピーを持つ |
| パスワード | AWS Cognito | Cognito が暗号化して管理 |
| ID | PostgreSQL | UUID（アプリケーション内の識別子） |
| 氏名 | PostgreSQL | |
| 氏名ふりがな | PostgreSQL | |
| ロール | PostgreSQL | `admin` / `user` |
| 作成日時 | PostgreSQL | |
| 更新日時 | PostgreSQL | |

Cognito の `sub`（Cognito 内部の UUID）を PostgreSQL の `cognito_sub` カラムに保存し、両者を紐づける。

### 2.2 DB スキーマ（`users` テーブル）

- テーブルは `petal` スキーマに置く。
- TypeORM の migrations テーブルは `public` スキーマに置く。

```sql
CREATE TYPE "petal"."user_role" AS ENUM ('admin', 'user');

CREATE TABLE "petal"."users" (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    email       VARCHAR(255) UNIQUE,           -- アプリ層で必須・一意を担保（DB は NULL 許容 + UNIQUE のみ）
    name        VARCHAR(100) NOT NULL,
    name_kana   VARCHAR(100) NOT NULL,
    role        user_role    NOT NULL DEFAULT 'user',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ  DEFAULT NULL
);
```

---

## 3. ロール

| ロール | 説明 |
| ------ | ---- |
| `admin` | ユーザーの登録・編集・削除、システム全体の管理 |
| `user` | 自分のコンテンツの管理（v2以降） |

各ロールが実行できる操作の詳細は、機能実装時に順次定義する。

ロールは **DB（`users.role`）が単一の真実**として扱う。Cognito グループ機能は使わず、認可は `JwtAuthGuard` の DB lookup によって `request.user.role` に解決される（[21_role-cognito-group-sync.md](21_role-cognito-group-sync.md)）。

---

## 4. 認証フロー

### 4.1 v1 のスコープ

| 機能 | v1 | v1.1 以降 |
| ---- | -- | --------- |
| ログイン（メール＋パスワード） | ○ | |
| ログアウト | ○ | |
| 管理者によるユーザー登録（招待メール送信） | ○ | |
| 管理者によるユーザー削除（DB softDelete + Cognito 無効化） | ○ | |
| 初回ログイン時のパスワード設定（NEW_PASSWORD_REQUIRED） | ○ | |
| サインアップ（ユーザー自己登録） | — | ○ |
| メール確認（Email Verification） | — | ○ |
| パスワードリセット | — | ○ |
| OAuth（Google / GitHub） | — | 将来構想 |

管理者によるユーザー登録・削除・初回ログインフローの詳細は [15_user-management-enhancement.md](15_user-management-enhancement.md) を参照。

### 4.2 パスワードポリシー（Cognito 設定）

| 項目 | 設定値 |
| ---- | ------ |
| 最低文字数 | 8文字 |
| 英大文字 | 必須 |
| 英小文字 | 必須 |
| 数字 | 必須 |
| 記号 | 任意 |

### 4.3 トークン有効期限（Cognito 設定）

| トークン | 有効期限 |
| -------- | -------- |
| アクセストークン | 1時間 |
| IDトークン | 1時間 |
| リフレッシュトークン | 30日 |

---

## 5. 環境別の認証方針

| 環境 | 認証の扱い |
| ---- | ---------- |
| Production | AWS Cognito（本番 User Pool） |
| Development | AWS Cognito（開発用 User Pool） |
| Local | AWS Cognito（開発用 User Pool を共用） |
| テスト実行時 | 認証ガードをスキップする仕組みを実装する |

Localstack の Cognito は使用しない。Local 環境でも実際の AWS Cognito に接続する。

テスト時の認証スキップは、NestJS の `AuthGuard` を環境変数で切り替えるカスタムガードとして実装する。

---

## 5.5 認証ガードの役割・仕組み・実装上の位置付け

### 何をしているのか

**認証ガード（Auth Guard）** は、すべての HTTP リクエストをコントローラーに渡す前に「このリクエストは本当に認証済みのユーザーからのものか」を確認する門番である。

具体的には以下を行う：

1. リクエストの `Authorization` ヘッダーから JWT（`Bearer <token>`）を取り出す
2. Cognito が公開している公開鍵（JWKS）を使って JWT の署名を検証する
3. トークンの有効期限・発行元（User Pool / Client ID）が正しいか確認する
4. 検証が通れば、`payload.sub` を使って DB の `users` テーブルから対応レコードを引く（[21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) §3.2 参照）
5. 該当ユーザーが存在しない / `deleted_at IS NOT NULL` の場合は `401 Unauthorized` を返す
6. `request.user` に正規化済みの `AuthUser`（`{ sub, userId, email, role }`）をセットしてリクエストを通す
7. 検証に失敗した場合は `401 Unauthorized` を返してリクエストをここで止める

### ロールベース認可（RolesGuard / @Roles）

`request.user.role` を使った認可は、`RolesGuard` と `@Roles(UserRole.Admin)` デコレータで宣言的に行う。
ロールはアプリケーション側 DB（`users.role`）が単一の真実であり、Cognito グループは使用しない。
詳細は [21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) を参照。

### 全体のどの位置付けか

Onion Architecture において、認証ガードは **コントローラー層の入口** に位置する横断的関心事（Cross-Cutting Concern）である。

```text
[HTTP リクエスト]
      ↓
 ┌────────────────────────────┐
 │  Auth Guard                │  ← ここ（コントローラーへの入口）
 │  JWT 検証（Cognito JWKS）  │
 └────────────────────────────┘
      ↓（検証OK）
 ┌────────────────────────────┐
 │  Controller                │
 └────────────────────────────┘
      ↓
 ┌────────────────────────────┐
 │  Service（Application）    │
 └────────────────────────────┘
      ↓
 ┌────────────────────────────┐
 │  Repository（Infra）       │
 └────────────────────────────┘
```

実装ファイルは `src/common/guards/jwt-auth.guard.ts` に置く。
NestJS の `CanActivate` インターフェースを実装したクラスで、`APP_GUARD` としてグローバル登録することで全エンドポイントに自動適用される。

### 最終的にどのような仕組みで認証されるか（エンドツーエンド）

```text
[フロントエンド]
  1. ログインフォームで メール＋パスワード を入力
  2. Cognito の認証エンドポイントに送信
  3. Cognito から 3種のトークンを受け取る
       - ID Token（ユーザー情報含む JWT）
       - Access Token（API 呼び出し用 JWT）  ← これを使用
       - Refresh Token（アクセストークン再発行用）
  4. Access Token をメモリ（または HttpOnly Cookie）に保存

[API リクエスト時]
  5. リクエストヘッダーに付与して送信
       Authorization: Bearer <Access Token>

[バックエンド]
  6. Auth Guard が Authorization ヘッダーを取り出す
  7. Cognito の JWKS エンドポイントから公開鍵を取得（初回のみ・以降キャッシュ）
       https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
  8. 公開鍵で JWT 署名を検証 ＋ 有効期限・User Pool・Client ID を確認
  9. 検証 OK → request.user に sub・email などをセット → Controller へ
 10. 検証 NG → 401 Unauthorized を返す（Controller には届かない）
```

### テスト時の扱い

環境変数 `SKIP_AUTH=true` のとき認証をスキップするカスタムガードとして実装する（5節参照）。実際の Cognito には接続せず、ダミーの `request.user` をセットして Controller まで通す。

### 使用ライブラリ

JWT の検証には AWS 公式ライブラリ `aws-jwt-verify` を使用する。
Cognito の JWKS を自動取得・キャッシュし、`CognitoJwtVerifier` で1行で検証できる。

---

## 6. 初期 Admin ユーザーの作成

専用スクリプトを実装し、実行によって Admin ユーザーを作成する。

- Cognito にユーザーを登録し、`sub` を取得する
- PostgreSQL の `users` テーブルに `role = 'admin'` のレコードを挿入する（`email` も保存する）
- スクリプトは `scripts/create-admin.ts` として実装する

---

## 7. 技術選定

| 項目 | 選定 |
| ---- | ---- |
| ORM | TypeORM |
| パッケージマネージャー | pnpm（npm / yarn は使用禁止） |
| テスト方針 | 要議論（別途決定） |
