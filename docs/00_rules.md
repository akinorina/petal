# Petal - 設計・実装ルール

## 1. アーキテクチャ

### オニオンアーキテクチャ

依存の方向は常に **外側 → 内側** とする。内側のレイヤーは外側を参照しない。

```text
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

### ドメインエンティティ・値オブジェクトの定義

ドメインの不変条件（フィールドの型・形式・範囲）は Zod スキーマで宣言し、コンストラクタで実行時バリデーションを行う。これにより「不正な状態のインスタンスは存在しない」ことを保証する。

ルール：

- フィールドの制約は Zod スキーマ（`<Name>Schema`）で定義する。
- TypeScript の型は `z.infer<typeof <Name>Schema>` で生成する。手書きの型と二重定義しない。
- コンストラクタはプロパティのオブジェクトを 1 つだけ受け取り、先頭で `<Name>Schema.parse(props)` を呼んで検証する。位置引数は使わない。
- 検証済みの値だけをフィールドに代入する。

例（`backend/src/user/domain/user.ts`）：

```ts
import { z } from 'zod';
import { UserRole } from './user-role.enum';

export const UserSchema = z.object({
  id: z.uuid(),
  cognitoSub: z.string().min(1),
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.enum(UserRole),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type UserProps = z.infer<typeof UserSchema>;

export class User {
  readonly id: string;
  // ... 各フィールド宣言 ...

  constructor(props: UserProps) {
    const validated = UserSchema.parse(props);
    this.id = validated.id;
    // ... 各フィールドへ代入 ...
  }
}
```

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

**フィーチャ（機能単位）優先で配置する**。各フィーチャを `src/<feature>/` 配下にまとめ、その内部でオニオンアーキテクチャのレイヤーごとに分割する。

```text
backend/
  src/                      # ランタイムコード（NestJS アプリ本体）
    <feature>/              # 例: user, auth, image など
      domain/               # エンティティ、値オブジェクト、リポジトリIF
      application/          # ユースケース（サービス）、入力スキーマ
      infra/                # DB エンティティ、リポジトリ実装、外部サービス連携
      controller/           # コントローラー・DTO
      <feature>.module.ts   # NestJS モジュール定義
    common/                 # 横断的関心事（ガード、デコレーター等）
    app.module.ts
    main.ts
  database/                 # CLI 専用：DataSource、マイグレーション
  scripts/                  # CLI 専用：管理用スクリプト
```

`src/` にはランタイム（HTTP サーバ）として動くコードのみを置く。`database/` `scripts/` は CLI で実行するツール群で、`src/` の外に置く。

### ルール

- レイヤー（`domain/` 等）を `src/` 直下に置かない。必ずフィーチャ配下に置く。
- フィーチャ内のファイルはすべていずれかのレイヤー（`domain/` `application/` `infra/` `controller/`）に属する。フィーチャ直下に `<feature>.module.ts` 以外のファイルを置かない。
- フィーチャに該当レイヤーの実体が存在しない場合（例: `auth` は domain エンティティを持たない）は、そのサブディレクトリを作らなくてよい。
- 外部サービス（Cognito、S3 等）の SDK 呼び出しは `infra/` に集約する。`application/` のサービスからは infra 層のクライアントを呼ぶ形にし、SDK を直接触らない。
- 複数フィーチャから参照される真に共通のコードのみ `common/` に置く。フィーチャ固有のものはフィーチャ内に置く。
- フィーチャ間の依存はモジュールの `exports` を経由する。他フィーチャの内部実装ファイルを直接 import しない。

### Frontend のページ構成

ページコンポーネント（`app/**/page.tsx`）は **View（JSX）に専念** させ、ステート・副作用・イベントハンドラなどのロジックは **同居するカスタムフック**に切り出す。

```text
app/login/
  page.tsx              # JSX のみ。フックを呼び出して props/handler を受け取り render する
  use-login-page.ts     # useState / useEffect / useCallback / fetch 呼び出し等のロジック
```

ルール：

- カスタムフックはページと同じディレクトリに置き、`use-<page>-page.ts` の命名にする。
- フックは `'use client'` を必要とせず、ページ側のみが `'use client'` を持つ。
- 1 ページにつき 1 フックを基本とし、無理に細分化しない。

### API アクセスの分離

ページフックの中に直接 `imageApi.xxx` 等の呼び出しを書かず、**API アクセス専用のカスタムフック**に分離して `frontend/lib/api-hooks/` に置く。

```text
frontend/lib/api-hooks/
  use-auth-api.ts          # ログイン / ログアウト / パスワードリセット 等
  use-users-api.ts         # ユーザー一覧 / CRUD / 復活
  use-images-api.ts        # 画像一覧 / アップロード / 削除
  use-image-detail-api.ts  # 画像詳細 / ダウンロード URL / 削除
```

ルール：

- API フックは **取得状態（data / isLoading / error）** と **操作関数（reload / create / update / 等）** を返す。
- 操作関数は失敗時に例外を `throw` し、呼び出し側（ページフック）で UI 文脈に応じたメッセージを `setError` する形にする（API フック内で UI 文言を決め打ちしない）。
- フィーチャ単位で 1 ファイル。複数ページから再利用できる API はここに集約する。
- ページフックは「UI 状態 + API フックの呼び出しのオーケストレーション」だけを行う。`@/lib/api` や `@/lib/cognito` を直接呼び出さない。

### AuthContext と useAuthApi の責務分担

- `AuthContext` は **認証グローバル状態**（`isAuthenticated`, `email`, `isLoading`）の保持に専念。
- `useAuthApi` は **認証 API 操作**（`login` / `logout` / `completeNewPassword` / `requestPasswordReset` / `confirmPasswordReset`）に専念。
- `AuthContext` の内部で `useAuthApi` を呼び、API 結果に応じて状態を更新する。アプリ側からは `useAuth()` 経由で従来どおり利用できる。

---

## 4. DB ルール

### ORM

TypeORM を使用する。

### マイグレーション

- `synchronize: false` を必ず設定する。TypeORM の自動スキーマ同期は使用しない。
- スキーマ変更はすべて migration ファイルで管理する。
- migration ファイルは `backend/database/migrations/` に置く。
- DB 接続設定は `backend/database/data-source.ts` に定義する（CLI 用）。

主要コマンド（`backend/` で実行）：

```bash
# エンティティ差分から migration ファイルを自動生成
pnpm migration:generate database/migrations/<名前>

# 空の migration ファイルを作成（手書き用）
pnpm migration:create database/migrations/<名前>

# migration を実行
pnpm migration:run

# 直前の migration を取り消し
pnpm migration:revert

# 適用済み migration の一覧確認
pnpm migration:show
```

### トランザクション境界 ― 外部副作用との整合性

DB の永続化と Cognito / S3 等の外部 API 副作用を **同時に変えなければならない**操作では、整合性を極力安全側に倒すために次の順序でトランザクション境界を引く。

```text
BEGIN
  （必要なら）重複・競合の事前チェック
  UPDATE / INSERT / DELETE （DB 側を先に変更し、まだ可視化しない）
  外部 API 呼び出し
    成功 → COMMIT
    失敗 → ROLLBACK（DB は元の状態に戻る）
END
```

- **DB を先に書き換えてからトランザクション保留** → **外部 API** → **成否で COMMIT/ROLLBACK** の順を厳守する。
- 反対の順序（外部 API 先行 → 後追いで DB UPDATE）は、外部成功後に DB 失敗が起きると整合性が崩れるため使わない。
- 不整合が残る窓は「外部 API 成功 → COMMIT 失敗」の極小ケースのみとなる。発生時はログに `user_id` 等の特定情報を残し、運用での復旧手順を設計ドキュメントに明記する。
- 外部 API のレイテンシ分だけトランザクションが長く保持される。対象行レベルロックの影響範囲を意識して設計する（自分の行のみを更新する操作なら問題は小さい）。
- トランザクション境界はリポジトリ I/F の `runInTransaction(fn)` 等で表現し、Application 層が TypeORM の `DataSource` / `EntityManager` を直接 import しないようにする（オニオン依存方向の維持）。

例外: 外部副作用がべき等で安全に再試行できる場合、または DB 更新と外部副作用が論理的に独立で「片方失敗ならもう片方も無効化したい」という要件が無い場合は、本ルールを適用しなくてよい。

参考実装: [docs/20_email-change-flow.md §3.2](20_email-change-flow.md)（メールアドレス変更フロー：DB UPDATE → Cognito Verify → COMMIT/ROLLBACK）

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

例外: **追記のみ** のテーブル（監査ログなど）は `deleted_at` を持たない。これらのテーブルは UPDATE / DELETE 系の API を提供しないことで「履歴として永続」させる。詳細は [docs/28_audit-logs.md](28_audit-logs.md) を参照。

---

## 5. 環境変数

- 環境変数は各アプリの `.env` ファイルで管理する。
- `.env` は機密情報を含むため **git にコミットしない**。
- `.env.example` に変数名とダミー値を記載してコミットする。新環境セットアップ時はこれをコピーして使う。

```bash
cp backend/.env.example backend/.env
```

---

## 6. Git ルール

### コミットメッセージ

コミットメッセージは **日本語** で記述する。

---

## 7. その他

- 本番・開発・Local の３環境を維持し、環境差分は環境変数で吸収する。
- Localstack は S3 などのストレージ系 AWS リソースのローカルエミュレートに使用する。
- Cognito については Local 環境でも実際の AWS Cognito を使用する（Localstack の Cognito は使わない）。

---

## 8. テスト方針

詳細は [docs/24_testing-strategy.md](24_testing-strategy.md) を参照。本節は要旨。

### 8.1 フレームワークと配置

- **Jest 30 + ts-jest**（既存）を使用する。HTTP 統合は `supertest`。
- ユニットテストは対象ファイルと **同居** させ `<file>.spec.ts` 命名（例: `user.service.ts` ↔ `user.service.spec.ts`）。
- e2e テストは `backend/test/*.e2e-spec.ts` に置く（Jest 設定が分かれている）。
- `describe` はクラス名 + メソッド名、`it` は日本語で振る舞いを記述する。

### 8.2 レイヤー別の責務

| レイヤー | テスト | 備考 |
| ---- | ---- | ---- |
| Domain | 必要に応じてユニット | `Zod` の不変条件は Service テストで間接的にカバーされる範囲を許容 |
| Application（`*.service.ts`） | **ユニット必須** | Repository / SDK クライアントを DI モックで差し替え |
| Infra（TypeORM・AWS SDK ラッパー） | スコープ外 | 統合テストは別タスクで方針を定める |
| Controller | 原則スコープ外 | 薄く Service に委譲するだけのため、Service テストで担保 |
| Cross-cutting（Guard など） | 原則スコープ外 | 既存の e2e で担保 |

### 8.3 モック戦略

- **Repository**: `IUserRepository` 等のインターフェースと DI シンボル（例: `USER_REPOSITORY`）を `useValue` でモック。`jest.Mocked<...>` で型安全を保つ。
- **Cognito クライアント**: 具象クラス（`CognitoAuthClient` / `CognitoUserClient`）を `useValue` でモック。**インターフェース化はしない**（DI で差替可能なため過剰抽象化を避ける）。例外判定メソッド（`isUserNotFound` 等）も spec 側で `jest.fn()` を実装する。
- **`runInTransaction`**: モックでは `(fn) => fn(txRepo)` の形で即時実行。実 DB トランザクションの挙動はユニットでは検証しない。

### 8.4 カバレッジと CI

- カバレッジ閾値は本書時点では設定しない（実態が見えてから別タスクで決める）。
- CI への組み込みは別タスク。本書の要件はローカルで `pnpm --filter backend test` が緑になること。

### 8.5 認証ガードのテスト時スキップ

`SKIP_AUTH=true` のときガードをスキップする仕組みを使う（[docs/11_user-info_and_authentication.md §5.5](11_user-info_and_authentication.md) 参照）。ユニットテストは Service 層に閉じるためガードは関与しない。e2e の共通化は別タスクで扱う。
