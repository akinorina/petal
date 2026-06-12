# TSK-112: フロントエンド route group `(admin)` を `(authenticated)` にリネーム

Notion: <https://app.notion.com/p/37c9ca7d99dc80859ec8cbc1ef4d4054>

## 課題シート（Notion より転記）

### 一行サマリ

フロントエンドのコードの (admin) ディレクトリの名称を適切なものに変更したい。

### 背景・動機

フロントエンドのコードにおいて、(admin) ディレクトリがあるが、このフォルダ以下はログイン・認証状態にあるユーザーが閲覧できるページである。ゆえに (admin) という名称を適切な名称に変更したい。

### 完了条件（原文）

- [ ] `frontend/src/app/(admin)` のディレクトリ名を適切なものに変更できた。

### スコープ外 / 制約 / 不明点

いずれもなし。

## 課題サマリ

`frontend/src/app/(admin)/` は Next.js の route group（URL に現れない）で、実態は「認証済みユーザー全員が閲覧できる領域」のシェルである。管理者専用領域は配下のネスト route group `(admin-only)/` が担っており、`(admin)` という名称は実態と乖離している。これを `(authenticated)` にリネームし、関連するファイル名・フック名・ドキュメント記述を追従させる。

## スコープ

### 対象

- `frontend/src/app/(admin)/` → `frontend/src/app/(authenticated)/` のディレクトリリネーム
- `(admin)/use-admin-layout.ts` → `(authenticated)/use-authenticated-layout.ts`、フック `useAdminLayout` → `useAuthenticatedLayout` の改名（import 元 `layout.tsx` も追従）
- `(admin-only)/layout.tsx` 内コメントの旧パス記述の更新
- `frontend/README.md` のディレクトリツリー記述の更新
- `docs/` 内の旧パス記述の更新（現行ドキュメント `20_features/` / `10_architecture/` に加え、過去の設計書 `specs/` / `tsk-110` / `tsk-113` も含めて全置換。ユーザー判断）

### 対象外

- ネスト route group `(admin-only)/` の名称（「管理者専用」の意味で正しいため変更しない）
- URL・ルーティング・認可ロジック（route group のため挙動に影響なし）
- backend

## 設計判断ログ

| 論点 | 採用案 | 理由 | 却下案 |
| --- | --- | --- | --- |
| 新名称 | `(authenticated)` | 「認証済みユーザーが閲覧できる領域」という実態を最も直接的に表す。`docs/20_features/05_authorization.md` の記述とも整合 | `(app)`（意味の自明性が低い）、`(member)`（role 名と紛らわしい）、`(protected)`（ほぼ同義だが採用案より曖昧） |
| 付随リネームの範囲 | フック・docs（過去設計書含む）まで全置換 | 旧名称が残ると検索性・一貫性を損なう。ユーザーが過去設計書の更新も選択 | docs は現行ドキュメントのみ更新（歴史的記録の保全） |
| `(admin-only)` の扱い | 変更しない | 管理者専用領域の意味でそのまま正しい | — |

## 既存設計との差分

`docs/10_architecture/03_frontend-architecture.md` 等に登場する route group 名が変わるのみ。アーキテクチャ・データモデル・API に変更なし。トランザクション境界: 該当なし（DB・外部副作用なし）。

## 完了条件（具体化版）

- [ ] `frontend/src/app/(authenticated)/` が存在し、`(admin)/` が存在しない
- [ ] `useAuthenticatedLayout` / `use-authenticated-layout.ts` に改名済みで、`useAdminLayout` / `use-admin-layout` の参照がリポジトリ内（`node_modules` / `.next` 除く）に残っていない
- [ ] リポジトリ内（`node_modules` / `.next` 除く）に `(admin)/` を指す旧パス記述が残っていない（`(admin-only)` は除く）
- [ ] `cd frontend && pnpm build` が通る
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る

## 手動動作確認シナリオ

1. `cd frontend && pnpm dev` を起動し、ログインして `/images` `/chat` `/me` が従来どおり表示される（URL 不変）
2. admin ロールで `/users` が表示され、認可ガード（`(admin-only)` layout の 403）が従来どおり機能する

## 未確定事項

なし。

## 実装計画

### 変更・追加ファイル

- リネーム: `frontend/src/app/(admin)/` → `frontend/src/app/(authenticated)/`（`git mv`）
- リネーム: `frontend/src/app/(authenticated)/use-admin-layout.ts` → `use-authenticated-layout.ts`
- 編集: `frontend/src/app/(authenticated)/layout.tsx`（import パス・フック名）
- 編集: `frontend/src/app/(authenticated)/use-authenticated-layout.ts`（関数名）
- 編集: `frontend/src/app/(authenticated)/(admin-only)/layout.tsx`（コメント内の旧パス）
- 編集: `frontend/README.md`
- 編集: `docs/` 内の旧パス記述を含む全ファイル（`20_features/01〜06,09` / `10_architecture/03` / `specs/17,20,29,44〜50,52,54,59〜62,67,68` / `tsk-110` / `tsk-113`。プレーン表記 `(admin)` と URL エンコード表記 `%28admin%29` の両方を置換）

migration / 環境変数 / 依存追加: なし。

### 作業順序（コミット単位）

1. **refactor(tsk-112): (admin) route group を (authenticated) にリネーム** — `git mv` によるディレクトリ・ファイルリネーム + フック名改名 + コメント・README 更新。確認: `cd frontend && pnpm build` が通り、`grep -r "(admin)/" frontend/src` と `grep -r "useAdminLayout\|use-admin-layout" frontend/src` が 0 件
2. **docs(tsk-112): (admin) の旧パス記述を (authenticated) に更新** — docs 全置換。確認: `grep -rn "(admin)" docs | grep -v "(admin-only)"` と `grep -rn "%28admin%29" docs` が 0 件、`npx markdownlint-cli 'docs/**/*.md'` が通る

### テスト方針

ロジック変更なしのため新規テストは追加しない。既存の確認手段（frontend build / markdownlint / 手動シナリオ）で担保する。

### 想定外時の判断ルール

- **AI 単独判断 OK**: 置換漏れの追加修正、リネームに伴う import パス調整
- **中断して要相談**: route group 変更が URL・ルーティング挙動に影響することが判明した場合、`(admin-only)` 側の変更が必要になった場合

### 事前解決済みの判断ポイント

- 新名称は `(authenticated)`（ユーザー確定）
- `use-admin-layout.ts` / `useAdminLayout` も改名する（ユーザー確定）
- docs は過去の設計書（specs / tsk-110 / tsk-113）も含めて全置換（ユーザー確定）
- `(admin-only)` は変更しない（ユーザー確定）
- docs 内リンクの URL エンコード表記 `%28admin%29` → `%28authenticated%29` も置換対象
