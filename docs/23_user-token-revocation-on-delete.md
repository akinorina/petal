# Petal - 削除ユーザーの既存トークン無効化 設計

対応タスク: **TSK-14「削除/無効化したユーザーの既存トークン無効化」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール（§4 トランザクション境界）
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/01_requirements.md](01_requirements.md) — 機能要件
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — TSK-4 ユーザー削除フロー（本書で更新）
- [docs/18_logout-api.md](18_logout-api.md) — GlobalSignOut の用法
- [docs/21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) — AuthGuard の DB lookup

---

## 1. スコープと完了条件

### 対象

1. `DELETE /users/:id` の削除フローに **`AdminUserGlobalSignOut`（リフレッシュトークンの強制失効）** を組み込む。
2. 削除直後に当該ユーザーの **アクセストークン** で API を叩いた場合、AuthGuard が 401 を返すことの担保（既存実装の確認とテスト追加）。
3. 上記設計を `docs/15_user-management-enhancement.md` の削除フロー記述と整合させる。

### 非対象（別タスク化）

- **ロール降格時の強制サインアウト**: PATCH /users/:id で role が降格された場合の `globalSignOut` 連動。UX/監査要件を別途整理するため別タスクで扱う（チケット TSK-14 本文の「検討」部分はここに該当）。
- **監査ログ（強制サインアウト記録）**: 監査ログ基盤未整備のため、別タスクと連動。
- **アクセストークンの即時失効そのもの**: Cognito の制約上不可能（最大 1h の TTL は仕様）。AuthGuard 側の DB lookup で代替するのが本設計の前提。

### 完了条件

- [ ] `DELETE /users/:id` 実行後、当該ユーザーの **リフレッシュトークン** が以後使えなくなる（`AdminUserGlobalSignOut` 呼び出しが入る）。
- [ ] `DELETE /users/:id` 実行後、当該ユーザーの **既存アクセストークン** で `GET /users/me` 等を叩くと **401** が返る（AuthGuard の `deletedAt` チェックで担保。既存実装。本タスクではテストで明文化）。
- [ ] 設計ドキュメント・`AGENTS.md` の表を更新。
- [ ] `pnpm --filter backend build` が通る。

---

## 2. 現状（変更前）

### 削除フロー (`UserService.remove`, [user.service.ts:248-262](../backend/src/user/application/user.service.ts#L248-L262))

```text
1. softDelete(id)              ... DB の users.deletedAt をセット
2. cognitoUser.disableUser(email) ... AdminDisableUser
   (失敗時は BadGatewayException、DB は softDelete 済み → 運用で再実行)
```

### AuthGuard ([jwt-auth.guard.ts:77-79](../backend/src/common/guards/jwt-auth.guard.ts#L77-L79))

```ts
const user = await this.userRepository.findByCognitoSub(sub);
if (!user || user.deletedAt !== null) {
  throw new UnauthorizedException('認証ユーザーに対応するレコードがありません');
}
```

→ DB が softDelete 済みであれば、有効期限内のアクセストークンでも **次回リクエスト時に 401**。完了条件 2 は既に満たされている。

### Cognito クライアント

[cognito-user.client.ts:127-142](../backend/src/user/infra/cognito-user.client.ts#L127-L142) に `globalSignOut(email)` が既に実装済み（`AdminUserGlobalSignOutCommand`、`UserNotFoundException` は握り潰し）。**未呼び出しのまま**。

---

## 3. 変更設計

### 3.1 削除フロー（変更後）

```text
1. findById(id)                          ... 削除対象の email を取得
2. softDelete(id)                        ... DB の deletedAt をセット
3. cognitoUser.globalSignOut(email)      ... 既存リフレッシュトークンを失効
4. cognitoUser.disableUser(email)        ... 以後の Cognito ログイン経路を閉じる
```

#### 順序の根拠

- **softDelete を最初**: AuthGuard の DB lookup でアクセストークン経路を即座に塞ぐのが最も重要。以降の Cognito 呼び出しが失敗しても、DB さえ落ちていればセキュリティ境界は守られる。
- **globalSignOut を disableUser より前**: `disableUser` の方が呼び出し失敗時の業務影響が大きい（再ログイン経路を閉じる主役）。先に `globalSignOut` でリフレッシュトークン失効を確定させ、`disableUser` 失敗の運用再実行で `globalSignOut` を再度呼ばない設計にできる。

#### エラーハンドリング

- **`globalSignOut` 失敗**: WARN ログを出すが処理継続（throw しない）。
  - 理由: リフレッシュトークン失効ができなくても、アクセストークン経路は softDelete で塞がっている（最大 1h で自然失効）。`disableUser` を巻き込んで運用再実行が必要になるよりは、`disableUser` まで進めて API 一貫性を保つ方が運用負担が低い。
  - `UserNotFoundException` は既存実装どおり握り潰し。
- **`disableUser` 失敗**: 現行どおり `BadGatewayException` を throw。DB は softDelete 済み・`globalSignOut` も実行済み。運用で `disableUser` のみ再実行できるよう、エラーメッセージで明記。

#### 補足: トランザクション境界

[docs/00_rules.md](00_rules.md) §4 の「DB UPDATE → 外部 API → COMMIT/ROLLBACK」原則は **新規作成系** に対する規定。**削除フロー** は「DB は確定して外部 API を呼ぶ（補償なし）」という TSK-4 で定めた既存方針を踏襲する。`globalSignOut` の追加もこの方針に従う。

### 3.2 AuthGuard 側

変更なし。完了条件 2 は既存実装で達成済みであることを **テストで明示** する（§4.2）。

### 3.3 ロール降格時の扱い

本タスクでは扱わない。`PATCH /users/:id` の role 変更時の `globalSignOut` 連動は **別タスク** とする。理由:

- UX の決定（自分自身を降格できるか・降格された側に何を表示するか）が必要。
- 監査ログ基盤と合わせて検討する方が筋が良い。

---

## 4. 動作確認

### 4.1 手動シナリオ

1. テストユーザー A でログインしアクセストークン `AT_A` / リフレッシュトークン `RT_A` を取得。
2. 管理者で `DELETE /users/{A.id}` を実行 → 200。
3. `GET /users/me` を `AT_A` で呼ぶ → **401** が返ること。
4. `RT_A` を使って Cognito の `InitiateAuth(REFRESH_TOKEN_AUTH)` を試す → **NotAuthorizedException**（Refresh Token has been revoked）が返ること。
5. A の email/password で再ログインを試す → Cognito 側で `disabled` のため失敗すること。

### 4.2 自動テスト（最低限）

- `UserService.remove` のユニットテストで、`softDelete` → `globalSignOut` → `disableUser` がこの順で呼ばれることを spy で検証。
- `globalSignOut` が throw した場合でも `disableUser` まで進み、メソッド全体は成功すること。
- `disableUser` が throw した場合は `BadGatewayException` で返ること（既存テスト維持）。

> 既存テストの構造に依存するため、追加範囲は実装計画 (Step 2) で確定する。

---

## 5. 影響範囲

| 種別 | パス | 変更概要 |
| --- | --- | --- |
| backend | `src/user/application/user.service.ts` | `remove()` に `globalSignOut` 呼び出しを追加、ログ追加 |
| backend (test) | `src/user/application/user.service.spec.ts`（無ければ追加検討） | 上記順序・エラーハンドリングのテスト |
| docs | `docs/15_user-management-enhancement.md` | 削除フローの記述に `globalSignOut` を追記 |
| docs | `docs/23_user-token-revocation-on-delete.md` | 本書（新規） |
| docs | `AGENTS.md` | ドキュメント表に本書を追記 |

migration / `.env.example` / フロントエンドの変更は **なし**。

---

## 6. リスク・未確定事項

- **既存テストの整備状況**: `user.service.spec.ts` の有無で追加 or 新規作成を判断（Step 2 で確認）。
- **`globalSignOut` 失敗を握り潰す方針**: 監査ログ基盤が整ったら、強制サインアウト失敗をログに残す要件が出る可能性あり。本タスクでは backend logger の WARN にとどめる。
