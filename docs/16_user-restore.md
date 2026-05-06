# Petal - 削除済みユーザーの再有効化 API 設計

対応タスク: **TSK-6「削除済みユーザーの再有効化 API」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md)
- [docs/03_workflow.md](03_workflow.md)
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md)
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — TSK-4 設計（本書で §12 を更新）

---

## 1. スコープと完了条件

### 対象

- **API のみ**: `POST /users/:id/restore` を実装する。
  - DB の `deleted_at` を NULL に戻す（TypeORM `restore`）。
  - Cognito 側を `AdminEnableUser` で有効化する。
  - 削除済みレコードを id で取得できるよう Repository / Service にオプションを追加。

### 非対象

- フロントエンド UI（**TSK-7「削除済みユーザーの閲覧・復活 UI」** で対応）。
- 削除済みユーザーの **一覧** API（`GET /users?deleted=true` 相当）も TSK-7 / ページング系タスクに寄せる。
- 招待メール再送（別タスク）。
- 復活後の通知メール（要望出てから別タスクで対応）。

### 完了条件

- [ ] `POST /users/:id/restore` で DB の `deleted_at` が NULL に戻る
- [ ] 同 API で Cognito 上のユーザーが Enabled に戻る
- [ ] 復活後に当該ユーザーで通常通りログインできる
- [ ] active ユーザーへの restore は 400 を返す
- [ ] 該当 id が存在しない場合は 404 を返す
- [ ] DB に softDelete 済みだが Cognito 上に存在しない不整合は 502 を返す
- [ ] [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) §12 を更新（本タスクで対応した旨を反映）

---

## 2. API 仕様

```text
POST /users/:id/restore
Authorization: Bearer <admin token>

Response 200:
{
  "id":         "uuid",
  "email":      "user@example.com",
  "cognitoSub": "uuid",
  "name":       "...",
  "nameKana":   "...",
  "role":       "user" | "admin",
  "createdAt":  "...",
  "updatedAt":  "...",
  "deletedAt":  null
}

Errors:
  400 — 対象ユーザーが既にアクティブ（softDelete されていない）
  403 — 認可エラー（admin 以外）  ※AuthGuard / 認可機構が整い次第
  404 — 対象 id が（softDelete 済みも含めて）存在しない
  502 — Cognito 連携に失敗 / Cognito 側にユーザーが存在しない（不整合）
```

---

## 3. シーケンス

```text
Client            Backend              PostgreSQL          Cognito
  │  POST /users/:id/restore                                 │
  │────────────────>│                                        │
  │                 │ findByIdWithDeleted                    │
  │                 │───────────────────>│                   │
  │                 │<── user (deleted_at != null) ─────────│
  │                 │                                        │
  │                 │ ※ deleted_at が null なら 400          │
  │                 │ ※ 見つからなければ 404                 │
  │                 │                                        │
  │                 │ restore(id)                            │
  │                 │───────────────────>│                   │
  │                 │<── ok ─────────────│                   │
  │                 │                                        │
  │                 │ AdminEnableUser(email)                 │
  │                 │───────────────────────────────────────>│
  │                 │<── ok / UserNotFoundException ────────│
  │                 │                                        │
  │                 │ ※ UserNotFoundException → 502          │
  │                 │ ※ その他 SDK 例外 → 502                │
  │                 │                                        │
  │<── 200 user ────│                                        │
```

### 3.1 順序と部分失敗

- 順序: **DB restore → Cognito Enable**（TSK-4 の `DELETE` と同方針 = 「DB を先、Cognito を後」）。
- Cognito Enable 失敗時は **502 を返しつつ DB は restore 済みのまま**。
- 運用での復旧手段:
  - 再 `POST /users/:id/restore` を行うと、現状の active ユーザーは 400 で弾かれる。
  - **本タスクではこのパスは未対応**として、復旧は次のいずれかに委譲:
    - 「DB と Cognito の不整合検知/修復スクリプト」タスク（既存タスク化済み）
    - 手動 SQL / コンソールでの個別対応
  - 将来必要になれば `?force=true` オプションで「DB が active でも Cognito Enable をリトライする」拡張を別タスクで検討。

### 3.2 Cognito Enable の冪等性

- Cognito 上で既に Enabled のユーザーに `AdminEnableUser` を投げても成功する。
- そのため Enable 前に状態確認はしない（無駄な API 呼び出しを避ける）。

---

## 4. ドメイン / アプリケーション層の変更

### 4.1 Repository IF 拡張

```ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByIdWithDeleted(id: string): Promise<User | null>;   // ← 追加
  findByCognitoSub(cognitoSub: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<User>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;                      // ← 追加
}
```

### 4.2 Repository 実装

- `findByIdWithDeleted`: `repo.findOne({ where: { id }, withDeleted: true })`。
- `restore`: `repo.restore(id)` を呼び、`deleted_at` を NULL に戻す。

### 4.3 Service 拡張

`UserService` に `restore(id: string): Promise<User>` を追加:

1. `findByIdWithDeleted(id)` で取得。`null` なら 404。
2. `user.deletedAt === null` なら 400（`既に有効なユーザーです`）。
3. `userRepository.restore(id)` を実行。
4. `cognitoUser.enableUser(user.email)` を実行（後述）。
5. `findById(id)` で active 状態の user を再取得して返す。

### 4.4 Cognito クライアント拡張

`user/infra/cognito-user.client.ts` に `enableUser(email)` を追加:

- `AdminEnableUserCommand` を呼ぶ。
- `UserNotFoundException` は **握り潰さず** 例外を投げる（Service 側で 502 に変換）。
  - ※ `disableUser` とは扱いが異なる点に注意（disable はべき等性のため握り潰し、enable は不整合検知のため明示）。

### 4.5 Controller

```ts
@Post(':id/restore')
@HttpCode(200)
async restore(@Param('id') id: string): Promise<UserResponseDto> {
  return toResponse(await this.userService.restore(id));
}
```

エラーマッピング:

| 失敗ケース | Service が投げる例外 | HTTP |
| ---------- | ---------------------- | ---- |
| 該当 id 不在 | `NotFoundException` | 404 |
| 既にアクティブ | `BadRequestException` | 400 |
| Cognito 未存在（不整合） | `BadGatewayException` | 502 |
| その他 Cognito 例外 | `BadGatewayException` | 502 |

---

## 5. Email 一意性まわり（補足）

- DB の `UQ_users_email` 制約は softDelete レコードも含めて email を占有する。よって「同 email で別ユーザーを新規登録」は softDelete 期間中もできない。
- 結果、softDelete 中の email は **本来そのユーザーのもの** である状態が保たれる。
- 復活時に email 衝突は発生しない（自分自身の email を取り戻すだけ）。
- 万一 Cognito 側で別 sub のユーザーが同 email を持っている異常ケースが起きても、`AdminEnableUser` は **対象 sub のユーザーを Enable する** だけで他 sub には影響しない。

---

## 6. 認可

- 現状 admin/user の認可ガードはコードベースに未実装（[docs/11_*](11_user-info_and_authentication.md) §3 の運用予定）。
- 本タスクではコントローラに `@AdminOnly()` 相当を **付けないが、付けるべき位置をコメントで明示しない**（コメント禁止ルール）。代わりに本ドキュメントで「将来的に admin ガード必須」と明記しておく。
- `restore` のエンドポイントは **将来 admin 限定にすること** を `15_*` / `11_*` の更新で残す。

---

## 7. テスト

- 既存方針が「テスト方針: 要議論」のまま（[docs/11_*](11_user-info_and_authentication.md) §7）。本タスクでも自動テストは追加せず、手動動作確認とビルド通過を完了条件とする。
- 別タスク「ユーザー / 認証フィーチャのテスト整備」で本機能も含めて整備する。

---

## 8. 既存ドキュメントの更新範囲

### 8.1 `docs/15_user-management-enhancement.md`

§12 の「削除済みユーザーの再有効化 API（運用ニーズ次第）」を「TSK-6 で対応済み（→ `docs/16_user-restore.md`）」に書き換える。

### 8.2 `AGENTS.md`

ドキュメント表に `16_user-restore.md` を追記。

### 8.3 `.env.example` / マイグレーション / IAM

- 環境変数: 追加なし。
- マイグレーション: 追加なし（`deleted_at` カラムは TSK-4 までで存在）。
- IAM: `cognito-idp:AdminEnableUser` を追加（[docs/14_*](14_cognito-user-pool-setup.md) §5 にもとから記載あり、現行 Local 用 IAM ポリシーには既に含まれる）。

---

## 9. 完了条件チェックリスト

§1 と同じ。実装完了時に確認。

---

## 10. 未確定事項 / 将来検討

- `?force=true` で Cognito Enable のみのリトライ（DB が既に active でも実行）を許可する拡張。
- 復活時に当該ユーザーへ通知メールを送るか。
- 復活後、過去のリフレッシュトークン（disable 期間中のもの）が再度有効化されないか確認。Cognito の挙動上、Disable で全 token が即時失効するかは仕様確認が必要 — 必要なら別タスクで `AdminUserGlobalSignOut` を併せる。
