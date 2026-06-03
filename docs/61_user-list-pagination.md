# ユーザー一覧のページング/検索/フィルタ 設計（TSK-23）

## 0. 課題シート（Notion 転記）

> Notion タスク: [ユーザー一覧のページング/検索/フィルタ](https://app.notion.com/p/3589ca7d99dc8198b29fe1d6122d2580)（TSK-23）

### 背景

現状 `GET /users` は全件返す。件数が増えると性能・転送量・UI 描画すべてで破綻する。

### 課題

- ページング: `limit` / `offset` または cursor 方式。本リポジトリでは `limit` / `offset` で十分。
- 検索: `q`（email / name / nameKana の部分一致）。
- フィルタ: `role` / `deleted`（softDelete 表示切替）。
- レスポンス形式: `{ items: User[], total: number, limit, offset }`。
- フロント: ページネーション UI、検索ボックス、ロールフィルタ。

### 完了条件（原文）

- `limit/offset` で結果が絞られる
- 検索クエリで部分一致ヒットする
- `role` / `deleted` フィルタが動く
- フロントでページ送り・検索が動作する

---

## 1. 課題サマリ

`GET /users` を `{ items, total, limit, offset }` 形式に変えて、ページング・部分一致検索・ロール/削除済みフィルタを 1 つのエンドポイントに統合する。Repository に `findPage({ limit, offset, q, role, deleted })` を追加し、TypeORM の QueryBuilder で `ILIKE` 部分一致と `withDeleted` を組み合わせる。フロント `/users` ページは検索ボックス・ロール Select・既存の design-system `Pagination` を追加し、`useUsersApi` に `page` / `q` / `role` を渡せるよう拡張する。

## 2. スコープ

### 対象

- backend: `GET /users` をページングレスポンスに変更（`{ items, total, limit, offset }`）。`q` / `role` / `deleted` の各クエリパラメータを追加
- backend: `IUserRepository.findPage(query)` の新設、`UserRepositoryImpl` で QueryBuilder 実装
- backend: 既存 `findAll` / `findAllDeleted` の置き換え（後方互換は維持しない。フロントは同 PR で更新）
- frontend: `/users` ページに検索ボックス・ロール Select・Pagination UI 追加、URL クエリ（`?page=2&q=foo&role=admin`）と同期
- frontend: `useUsersApi` を `findPage` 仕様に合わせる
- docs / openapi 再生成

### 対象外

- cursor 方式のページング
- 全文検索エンジン（pg_trgm / 外部）
- ソート順の切り替え UI（固定順 `createdAt DESC`）
- 監査ログ画面のページング（別タスク）

## 3. 制約

- 認可: 既存どおり `@Roles(UserRole.Admin)`。
- `limit` の最大値は **100**、デフォルト **20**。範囲外は 400。
- `offset` は 0 以上の整数。
- 検索は **email / name / nameKana の OR 部分一致**（`ILIKE`）。大文字小文字区別なし。
- `role` クエリは `admin` / `user` のいずれか。指定なしで全ロール。
- `deleted` クエリは `true` / `false`。デフォルト `false`（アクティブのみ）。`true` のときは softDelete 済みのみ返す（現行 `findAllDeleted` の挙動を踏襲）。両方混在で返す UI 要件はないため `all` モードは入れない。
- DB マイグレーション追加なし（既存インデックスで足りるか判断 → §5）。
- オニオン依存方向（Domain は Infra を参照しない）維持。

## 4. 設計判断ログ

### 判断 1: ページング方式 → **offset 方式**（採用）

- 件数が数千規模までの想定。UI 上「N ページ目」の固定 URL が望ましいため offset。
- cursor 方式は不要。

### 判断 2: 検索対象 → **email / name / nameKana の OR 部分一致**（採用）

- Cognito 側の検索は対象外（DB のみ）。`role` は別フィルタなので `q` に含めない。
- `ILIKE '%q%'` を 3 カラム OR。大文字小文字は `ILIKE` で吸収。
- 性能対策のインデックスは v1 では追加しない（実測してから別タスク）。**理由**: 数千件規模では Seq Scan でも十分。`pg_trgm` GIN インデックスは導入コストが見合わない。

### 判断 3: deleted フィルタ → **`true` でソフト削除済みのみ・`false`（デフォルト）でアクティブのみ**（採用）

- 現行 `findAll` / `findAllDeleted` の二択を維持。UI でも「アクティブ」「削除済み」タブが既にある。
- `all`（混在）モードは導入しない。

### 判断 4: レスポンス形状 → **`{ items, total, limit, offset }`**（採用）

- `total` は同一フィルタでの全件カウント。
- フロントは `Math.ceil(total / limit)` で総ページ数を出す。
- 既存の `GET /users` は配列を返していたが、後方互換は維持せず破壊的に変える。フロントは同 PR で更新。

### 判断 5: ロールフィルタ → **`role=admin|user`（指定なしで全件）**（採用）

- enum 不一致は Zod で 400。

### 判断 6: フロント URL クエリ同期 → **`?page` / `?q` / `?role` / `?deleted` を URL に反映**（採用）

- ブラウザバック / 共有可能性のため URL に状態を持つ。`useSearchParams` + `router.replace` でクライアント側遷移。
- `page` は 1 始まり、`offset = (page - 1) * limit`。

### 判断 7: 検索の発火 → **デバウンス 300ms**（採用）

- 入力ごとに API を叩かないように 300ms デバウンス。ロール / 削除済みタブ切替は即時。

## 5. データモデル

DB スキーマ変更なし。インデックス追加なし（判断 2 を参照）。

## 6. API 仕様

### `GET /users`（admin 限定）

クエリパラメータ:

| 名前 | 型 | デフォルト | 備考 |
| ---- | -- | ---------- | ---- |
| `limit` | integer (1-100) | 20 | 範囲外で 400 |
| `offset` | integer (>=0) | 0 | |
| `q` | string (max 100) | なし | trim 後に空なら無視 |
| `role` | `admin` \| `user` | なし | enum 不一致で 400 |
| `deleted` | `true` \| `false` | `false` | `true` でソフト削除済みのみ |

レスポンス（200）:

```json
{
  "items": [ { "id": "...", "email": "...", ... } ],
  "total": 123,
  "limit": 20,
  "offset": 0
}
```

- `items` 要素は既存 `UserResponseDto`。
- 並び順は `createdAt DESC, id ASC`（タイブレーク）。

## 7. 既存設計との差分

- `ListUsersQuerySchema` を `{ limit, offset, q, role, deleted }` に拡張。
- `IUserRepository`: `findAll` / `findAllDeleted` を撤去し、`findPage(query)` を追加。
- `UserRepositoryImpl.findPage` を QueryBuilder で実装（OR 検索・ロール条件・withDeleted 切替・count）。
- `UserService.findAll` / `findAllDeleted` を `findPage` に置き換え。
- `UserController.findAll` がページングレスポンスを返す形に変更。
- `UserResponseDto` 配列を返す箇所はラップ DTO `PaginatedUsersResponseDto` を新設。
- frontend:
  - `useUsersApi`: `findAll` を `findPage({ page, limit, q, role, deleted })` に変更。
  - `use-users-page`: `tab` ベースから URL クエリ駆動に。`q` / `role` / `page` を保持。
  - `page.tsx`: 検索ボックス・ロール Select・Pagination・件数表示を追加。
- `openapi.json` / `schema.d.ts` 再生成。

## 8. トランザクション境界

なし（読み取り専用。`SELECT` と `COUNT` の 2 クエリを同一トランザクションにまとめる必要はない。同時更新で多少のずれが出ても UX 上問題ない）。

## 9. 完了条件（具体化）

- [ ] `GET /users?limit=10&offset=0` が `{ items, total, limit, offset }` を返す
- [ ] `q=部分文字列` で email / name / nameKana の OR 部分一致（大文字小文字無視）がヒットする
- [ ] `role=admin` でロール絞り込みが効く
- [ ] `deleted=true` でソフト削除済みのみが返り、`false` でアクティブのみが返る
- [ ] `limit > 100` / `limit < 1` / `offset < 0` / `role` enum 不一致で 400
- [ ] フロント `/users` で検索・ロール選択・ページ送りが動き、URL クエリと同期する
- [ ] 検索入力は 300ms デバウンス、ロール/タブ切替は即時、ページ切替時は先頭ページに戻る検索イベントと干渉しない
- [ ] `UserRepositoryImpl.findPage` の DB レイヤー結合テスト（既存テスト DB がなければ `UserService` のモックテスト）
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` / `cd frontend && pnpm lint && pnpm build` が通る

## 10. 手動動作確認シナリオ

1. admin で `/users` にアクセス → 既定で 20 件 + 件数表示 + ページ送り UI が表示される。
2. 検索ボックスに `田中` と入力 → 300ms 後に部分一致結果に絞られ、URL が `?q=%E7%94%B0%E4%B8%AD` に同期する。
3. ロール Select で「管理者」を選ぶ → admin のみに絞られる。URL `?role=admin`。
4. 「削除済み」タブに切替 → ソフト削除済みのみが表示され、URL `?deleted=true`。
5. 2 ページ目に進む → `?page=2`。検索ボックスをクリアすると 1 ページ目に戻る。
6. 一般ユーザーで `/users` にアクセス → 403（既存の RolesGuard により）。
7. 不正なクエリ（`?limit=999`）を URL 直打ち → 400 のエラーメッセージが UI に表示される。

## 11. 未確定事項

- 検索性能の閾値（ユーザー数 1 万超を想定するか）。本タスクでは v1 として Seq Scan で許容。閾値超過時に `pg_trgm` GIN を別タスクで追加。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### backend

- `src/user/application/user.schemas.ts`（変更）: `ListUsersQuerySchema` を拡張（`limit`/`offset`/`q`/`role`/`deleted`、coerce + 範囲チェック）。`ListUsersQuery` 型のエクスポート更新
- `src/user/domain/user.repository.ts`（変更）: `findAll` / `findAllDeleted` 削除し、`findPage(query: UserPageQuery): Promise<{ items: User[]; total: number }>` を追加
- `src/user/infra/user.repository.impl.ts`（変更）: `findPage` を QueryBuilder で実装（`withDeleted` 切替 + `ILIKE` OR + `role` 条件 + `orderBy createdAt DESC, id ASC` + `take/skip` + `getManyAndCount`）
- `src/user/application/user.service.ts`（変更）: `findAll` / `findAllDeleted` を `findPage(query)` に置き換え
- `src/user/controller/user.controller.ts`（変更）: `findAll` がページングレスポンスを返す
- `src/user/controller/user.dto.ts`（変更）: `ListUsersQueryDto` を拡張、`PaginatedUsersResponseDto` を新設
- `src/user/application/user.service.spec.ts`（変更）: モック切替 + `findPage` のテスト
- `openapi.json`（再生成）

#### frontend

- `src/lib/api.ts`（変更）: `userApi.findPage(query)` に切替（旧 `findAll` 撤去）
- `src/lib/api-hooks/use-users-api.ts`（変更）: `useUsersApi(query)` で `items` / `total` を返す
- `src/app/(admin)/users/use-users-page.ts`（変更）: URL クエリ駆動の状態管理（`q` / `role` / `deleted` / `page`）、デバウンス検索、ページ番号 → offset 変換
- `src/app/(admin)/users/page.tsx`（変更）: 検索 `Input` + ロール `Select` + 既存 `Pagination` を追加。タブはそのまま使うが `deleted` クエリ同期に書き換え
- `src/lib/openapi/schema.d.ts`（再生成）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **backend: findPage 実装 + ListUsersQuery 拡張 + openapi 再生成** — 完了確認 `cd backend && pnpm lint && pnpm test && pnpm build`。`openapi.json` で `ListUsersQueryDto` / `PaginatedUsersResponseDto` が出る
2. **frontend: useUsersApi / 状態管理 / 画面 UI 拡張 + schema 再生成** — 完了確認 `cd frontend && pnpm lint && pnpm build`

### 12.3 テスト方針

- `user.service.spec.ts`: `findPage` の query 受け渡し、`role`/`q`/`deleted` 各フィルタが repository に渡ることを確認。
- `UserRepositoryImpl.findPage` はインメモリ DB が無いため、service レベルでモック検証 + 手動シナリオ（§10）で担保。
- frontend は手動動作確認のみ。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 検索 UI の細部文言、Pagination の見た目、デバウンス時間の微調整、`createdAt DESC` のセカンダリキー。
- **中断して相談**: 既存 `deleted` タブ UI 維持 vs 単一ビューへの統合、ロール以外のフィルタ追加要望、cursor 方式への切替、`pg_trgm` インデックス追加が必要となった場合。

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | レスポンス形 | `{ items, total, limit, offset }` |
| 2 | デフォルト limit | 20 / 上限 100 |
| 3 | 検索対象 | email / name / nameKana の OR `ILIKE` 部分一致 |
| 4 | deleted 値 | `true`/`false` の二択（`all` なし） |
| 5 | 並び順 | `createdAt DESC, id ASC` |
| 6 | URL クエリ同期 | `?page` / `?q` / `?role` / `?deleted` を query に反映 |
| 7 | 検索入力デバウンス | 300ms |
| 8 | 後方互換 | 旧 `findAll` 配列形式は維持しない。同 PR でフロントを更新 |
