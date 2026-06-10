# コーディング規約

設計・実装で守るルール。原典は [specs/00_rules.md](../specs/00_rules.md)。アーキテクチャの詳細は [02_backend-architecture.md](02_backend-architecture.md) / [03_frontend-architecture.md](03_frontend-architecture.md) を参照。

## TypeScript

- `any` は使用しない。型不明な場合は `unknown` を使い適切に絞り込む。
- `strict` モードを有効にする。

## Zod

- 外部入力（API リクエスト・環境変数等）はすべて Zod でバリデーションする。
- Zod スキーマから型を生成（`z.infer`）し、型定義を二重化しない。
- ドメインエンティティは Zod スキーマで不変条件を定義し、コンストラクタで `parse()` する（[04_domain-model.md](04_domain-model.md)）。

## バックエンド構成

- DDD + オニオンアーキテクチャ。依存方向は外→内。Domain は Infrastructure を参照しない。
- フィーチャ優先構成。`src/<feature>/{domain,application,infra,controller}/`。レイヤーを `src/` 直下に置かない。
- 外部 SDK（Cognito, S3）の呼び出しは `infra/` に隔離。`application/` から SDK を直接触らない。
- フィーチャ間依存はモジュールの `exports` 経由。他フィーチャの内部実装を直接 import しない。

## フロントエンド構成

- ページ（`app/**/page.tsx`）は View に専念。ロジックは同居フック `use-<page>-page.ts` に切り出す。
- API アクセスは `lib/api-hooks/` の専用フックに分離する。ページフックから `lib/api` / `lib/openapi` を直接呼ばない。
- API フックは状態 + 操作関数を返し、失敗時は例外を throw（UI 文言は呼び出し側が決める）。

## DB

- TypeORM、`synchronize: false`。スキーマ変更は `backend/database/migrations/` のマイグレーションで管理。
- 削除はすべて論理削除（`@DeleteDateColumn`）。物理削除しない（例外: 追記専用の audit_logs）。
- DB 永続化と外部副作用を同時に変える操作はトランザクション境界を `runInTransaction(fn)` で表現（[02_backend-architecture.md](02_backend-architecture.md)）。

## 環境変数

- `.env` はコミットしない。`.env.example` を更新する。
- クライアントシークレット等の秘密情報を `NEXT_PUBLIC_*` に置かない（ブラウザに露出する）。

## Git

- コミットメッセージは日本語。
- `git push --force` / `git reset --hard` / `branch -D` 等の破壊的操作はユーザーの明示的許可なく実行しない。
- 詳細・リリース運用は [40_processes/03_git-and-release.md](../40_processes/03_git-and-release.md)。

## ファイル削除（.trash 退避）

- ファイル・ディレクトリ削除は `rm` で物理削除せず、リポジトリ直下の `.trash/`（`.gitignore` 済み）へ `mv` で退避する。
- 中間生成物・一時ファイルの片付けも同様。

## やってはいけないこと

- `docs/` のルールに反する実装。
- npm / yarn の使用（pnpm のみ）。
- 物理削除の実装。
- Domain 層から Infrastructure（TypeORM, AWS SDK 等）を直接 import。
- フロントエンドにクライアントシークレット等を含める。
- ユーザー許可なしの破壊的 Git 操作。

## 関連ドキュメント

- 原典 → [specs/00_rules.md](../specs/00_rules.md)
- テスト → [40_processes/02_testing-strategy.md](../40_processes/02_testing-strategy.md)
