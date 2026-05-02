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
| メールアドレス | AWS Cognito | ログイン ID として使用 |
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

---

## 4. 認証フロー

### 4.1 v1 のスコープ

| 機能 | v1 | v1.1 以降 |
| ---- | -- | --------- |
| ログイン（メール＋パスワード） | ○ | |
| ログアウト | ○ | |
| サインアップ（ユーザー自己登録） | — | ○ |
| メール確認（Email Verification） | — | ○ |
| パスワードリセット | — | ○ |
| OAuth（Google / GitHub） | — | 将来構想 |

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

## 6. 初期 Admin ユーザーの作成

専用スクリプトを実装し、実行によって Admin ユーザーを作成する。

- Cognito にユーザーを登録し、`sub` を取得する
- PostgreSQL の `users` テーブルに `role = 'admin'` のレコードを挿入する
- スクリプトは `scripts/create-admin.ts` として実装する

---

## 7. 技術選定

| 項目 | 選定 |
| ---- | ---- |
| ORM | TypeORM |
| パッケージマネージャー | pnpm（npm / yarn は使用禁止） |
| テスト方針 | 要議論（別途決定） |
