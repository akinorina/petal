# Petal - 削除済みユーザーの閲覧・復活 UI 設計

対応タスク: **TSK-7「削除済みユーザーの閲覧・復活 UI」**

関連ドキュメント:

- [docs/03_workflow.md](03_workflow.md)
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — TSK-4 設計
- [docs/16_user-restore.md](16_user-restore.md) — TSK-6 再有効化 API 設計

---

## 1. スコープと完了条件

### 対象

- **Backend**: `GET /users?deleted=true` で削除済みユーザーのみを返す対応。
- **Frontend**: ユーザー管理画面に「アクティブ / 削除済み」を切り替えるタブ UI を追加し、削除済み行に「復活」ボタンを置く。確認モーダル経由で `POST /users/:id/restore` を叩く。

### 非対象

- ページング / 検索 / `role` フィルタ（別タスク「ユーザー一覧のページング/検索/フィルタ」で対応）。
- 削除済み一覧の admin 限定化（認可ガードが未整備のため将来課題）。

### 完了条件

- [ ] `GET /users?deleted=true` で **削除済みユーザーのみ** が返る
- [ ] `GET /users` または `?deleted=false` で **アクティブのみ**（従来通り）が返る
- [ ] フロントの管理画面に「アクティブ / 削除済み」タブが表示される
- [ ] 削除済みタブで該当ユーザーが一覧表示される
- [ ] 「復活」ボタン → 確認モーダル → 復活実行で当該ユーザーがアクティブ一覧に戻る
- [ ] 復活したユーザーで通常通りログインできる

---

## 2. API 仕様

```text
GET /users
GET /users?deleted=false   ← default。アクティブのみ
GET /users?deleted=true    ← 削除済みのみ

Response 200:
[
  {
    "id": "...",
    "email": "...",
    "cognitoSub": "...",
    "name": "...",
    "nameKana": "...",
    "role": "user" | "admin",
    "createdAt": "...",
    "updatedAt": "...",
    "deletedAt": "..." | null
  },
  ...
]
```

- `deleted` 以外のクエリパラメータは本タスクでは受け付けない（無視ではなく未定義）。
- `deleted=true` の場合のみ `deletedAt` が非 null になる。

### 2.1 値の解釈

- `deleted` パラメータは Zod で `z.coerce.boolean()` 風に厳密に扱う。具体的には `'true'` / `'false'` の文字列のみを受け取り、それ以外は 400。
  - 実装的には Zod の `z.enum(['true', 'false'])` を使い、boolean に変換してサービスに渡す。
  - 省略時は `false` 扱い。

---

## 3. ドメイン / アプリケーション層の変更

### 3.1 Repository IF

```ts
findAll(): Promise<User[]>;                  // 既存（active のみ）
findAllDeleted(): Promise<User[]>;           // 追加（deleted_at NOT NULL のみ）
```

実装:

- `findAllDeleted`: TypeORM の `repo.find({ withDeleted: true, where: { deletedAt: Not(IsNull()) } })`。

> 「アクティブ + 削除済み混合」用のメソッドは本タスクでは追加しない（不要）。

### 3.2 Service

`findAll(includeDeletedOnly: boolean = false)` のような bool 引数を service に持たせるのではなく、Service レベルでは **2 つのメソッド** に分ける:

```ts
findAll(): Promise<User[]>;          // 既存
findAllDeleted(): Promise<User[]>;   // 追加
```

呼び分けは Controller 層が `deleted` クエリで決定する。理由：

- Service の責務として「アクティブ取得」「削除済み取得」は意味的に別ユースケース
- bool 引数より明示的なメソッド名のほうが将来の検索フィルタ追加と整合する

### 3.3 Controller

```ts
@Get()
async findAll(@Query() query: ListUsersQueryDto): Promise<UserResponseDto[]> {
  const parsed = ListUsersQuerySchema.safeParse(query);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

  const users = parsed.data.deleted
    ? await this.userService.findAllDeleted()
    : await this.userService.findAll();
  return users.map(toResponse);
}
```

- `ListUsersQuerySchema`: `z.object({ deleted: z.enum(['true', 'false']).optional().transform(v => v === 'true') })`
- DTO: `class ListUsersQueryDto { deleted?: 'true' | 'false'; }`（OpenAPI 用）

---

## 4. フロントエンド設計

### 4.1 画面構成

`app/(admin)/users/page.tsx` を改修:

- ページ最上部に **タブ（または segmented control）** を配置:
  - 「アクティブ」（デフォルト）
  - 「削除済み」
- タブ切り替えで `userApi.findAll()` 呼び出しの引数を切替（後述）。
- 行ごとの操作ボタン:
  - アクティブタブ: 既存通り「編集」「削除」
  - 削除済みタブ: 「復活」のみ
- 「復活」クリック → `ConfirmModal`「{name} を復活させますか？」→ 確定で `userApi.restore(id)` → 一覧再取得。

### 4.2 API クライアント

`frontend/lib/api.ts` の `userApi` を拡張:

```ts
export const userApi = {
  findAll: (params?: { deleted?: boolean }) =>
    unwrap(
      apiClient.GET('/users', {
        params: {
          query: params?.deleted ? { deleted: 'true' } : undefined,
        },
      }),
    ),
  // ...
  restore: (id: string) =>
    unwrap(
      apiClient.POST('/users/{id}/restore', { params: { path: { id } } }),
    ),
};
```

### 4.3 表示の差異

- 削除済みタブの行では「メールアドレス」列の右に `削除日: YYYY/MM/DD` を補助表示（`deletedAt`）。
- 削除済みタブで件数 0 のときは「削除済みユーザーはいません」を表示。

---

## 5. 認可

- 現状 admin/user の認可ガードは未整備のため、本タスクでも UI 側で admin 限定の表示分岐は行わない。
- 認可整備時に `@AdminOnly()` を `GET /users` および `POST /users/:id/restore` に付与する想定（将来タスクの記述に委譲）。

---

## 6. 既存ドキュメントの更新範囲

### 6.1 `AGENTS.md`

ドキュメント表に `17_deleted-users-ui.md` を追記。

### 6.2 既存設計書

- `docs/15_user-management-enhancement.md` / `docs/16_user-restore.md` には変更なし（情報の追加・参照のみ）。

### 6.3 環境変数 / マイグレーション / IAM

- 変更なし。

---

## 7. テスト

- 自動テストは追加せず、手動動作確認とビルド通過を完了条件とする（[docs/11_*](11_user-info_and_authentication.md) §7 の方針継続）。

---

## 8. 完了条件チェックリスト

§1 と同じ。

---

## 9. 未確定事項 / 将来検討

- ページング/検索/フィルタタスクで `deleted` 以外のクエリ（`q`, `role`）を追加する時、本タスクの `ListUsersQuerySchema` を拡張する形で進める。
- 「ゴミ箱を空にする」相当の物理削除 UI は不要（ルール上 物理削除しない / 整合性修復スクリプトの責務）。
- 復活時の通知メール送信は別タスク化済み（しない方針）。
