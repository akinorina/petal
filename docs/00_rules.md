# Petal - 設計・実装ルール

## 1. アーキテクチャ

### オニオンアーキテクチャ

依存の方向は常に **外側 → 内側** とする。内側のレイヤーは外側を参照しない。

```
┌─────────────────────────────┐
│  Infrastructure（外側）      │ DB, S3, Cognito, HTTP など
│  ┌───────────────────────┐  │
│  │  Application          │  │ ユースケース（サービス層）
│  │  ┌─────────────────┐  │  │
│  │  │  Domain（内側）  │  │  │ エンティティ、値オブジェクト、リポジトリIF
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- **Domain**: ビジネスロジックの中核。外部への依存を持たない。
- **Application**: ユースケースを実装する。Domain を利用し、Infrastructure には依存しない。
- **Infrastructure**: DB・外部サービスなどの具体的な実装。Domain のインターフェースを実装する。

### ドメイン駆動設計（DDD）

- ドメインの概念をコードに反映させる（エンティティ、値オブジェクト、集約、リポジトリ）。
- ビジネスルールは Domain レイヤーに集約する。Application や Infrastructure に書かない。
- リポジトリのインターフェースは Domain に定義し、実装は Infrastructure に置く。

---

## 2. コーディングルール

### TypeScript

- `any` は使用しない。型が不明な場合は `unknown` を使い、適切に絞り込む。
- `strict` モードを有効にする。

### Zod

- 外部からの入力（APIリクエスト、環境変数など）はすべて Zod でバリデーションする。
- Zod スキーマから TypeScript 型を生成し、型定義の重複を避ける。

```ts
const UserSchema = z.object({ ... });
type User = z.infer<typeof UserSchema>;
```

---

## 3. ディレクトリ構成方針

レイヤーごとにディレクトリを分け、ドメインごとにまとめる。

```
src/
  domain/          # エンティティ、値オブジェクト、リポジトリIF
  application/     # ユースケース（サービス）
  infrastructure/  # DB, S3, Cognito などの実装
  presentation/    # コントローラー（NestJS モジュール）
```

---

## 4. DB ルール

### ORM

TypeORM を使用する。

### マイグレーション

- `synchronize: false` を必ず設定する。TypeORM の自動スキーマ同期は使用しない。
- スキーマ変更はすべて migration ファイルで管理する。
- migration ファイルは `backend/src/database/migrations/` に置く。
- DB 接続設定は `backend/src/database/data-source.ts` に定義する（CLI 用）。

主要コマンド（`backend/` で実行）：

```bash
# エンティティ差分から migration ファイルを自動生成
pnpm migration:generate src/database/migrations/<名前>

# 空の migration ファイルを作成（手書き用）
pnpm migration:create src/database/migrations/<名前>

# migration を実行
pnpm migration:run

# 直前の migration を取り消し
pnpm migration:revert

# 適用済み migration の一覧確認
pnpm migration:show
```

### 論理削除（ソフトデリート）

DB上のレコードの削除は、すべて **論理削除** とする。物理削除は行わない。

- すべてのテーブルに `deleted_at TIMESTAMPTZ` カラムを設ける。
- TypeORM の `@DeleteDateColumn()` デコレーターを使用する。
- `deleted_at` が `NULL` でないレコードは削除済みとみなす。
- クエリは TypeORM のソフトデリート機能により、削除済みレコードを自動的に除外する。

```ts
@DeleteDateColumn({ name: 'deleted_at' })
deletedAt: Date | null;
```

---

## 5. 環境変数

- 環境変数は各アプリの `.env` ファイルで管理する。
- `.env` は機密情報を含むため **git にコミットしない**。
- `.env.example` に変数名とダミー値を記載してコミットする。新環境セットアップ時はこれをコピーして使う。

```bash
cp backend/.env.example backend/.env
```

---

## 6. その他

- 本番・開発・Local の３環境を維持し、環境差分は環境変数で吸収する。
- Localstack は S3 などのストレージ系 AWS リソースのローカルエミュレートに使用する。
- Cognito については Local 環境でも実際の AWS Cognito を使用する（Localstack の Cognito は使わない）。
