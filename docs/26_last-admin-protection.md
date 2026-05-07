# Petal - 最後の admin の削除/降格を防ぐ 設計

対応タスク: **TSK-16「最後の admin の削除/降格を防ぐ」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — ユーザー管理機能 拡張設計
- [docs/21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) — ロール認可基盤（`@Roles(Admin)` 適用済み）
- [docs/24_testing-strategy.md](24_testing-strategy.md) — テスト方針

---

## 1. 背景

現状、`DELETE /users/:id` は admin であれば任意のユーザーを削除でき、`PATCH /users/:id` は role を `user` に降格できる。最後の admin が削除 / 降格されると **管理操作ができなくなり詰む**。また、操作者が誤って自分自身を削除してもサービスが詰む。

---

## 2. スコープと完了条件

### 対象

1. `DELETE /users/:id` で次の条件いずれかなら **409 Conflict** を返す。
   - 操作対象が **admin** かつ **active な admin 数が 1** （= 最後の admin）
   - 操作対象が **自分自身**（`actor.userId === id`）
2. `PATCH /users/:id` で次の条件なら **409 Conflict** を返す。
   - 操作対象の **現 role が admin** かつ **入力 role が `user`**（降格）かつ **active な admin 数が 1**
3. 専用例外 `LastAdminConflictException`（HTTP 409）を `backend/src/common/exceptions/` に新設し、エラーメッセージを統一。
4. `IUserRepository.countActiveAdmins()` を追加し、`softDelete` 除外で role=admin の件数を返す。
5. ユニットテストを追加（`UserService.remove` / `UserService.update` の各分岐）。

### 非対象（別タスク化）

- **レースコンディション対策**（同時に 2 人の admin を削除）。Notion チケット原文「行ロックで厳密にやる場合」は本タスクでは扱わない。アプリ層チェックに留める（Notion で「本タスクではアプリ層チェックでよい」と明記されているとおり）。
- **自分自身の admin → user 降格**: 拒否対象に含めない。理由: 最後の admin であれば §2 の (2) で弾かれる。最後でなければ意図的な降格を許容するのが自然（運用上の手段として残す）。Notion チケット原文も「自分自身の **削除** を基本的に拒否」とある通り。
- **フロントエンド側の事前バリデーション**（同種のメッセージを UI で先出し）。本タスクでは backend で 409 を返すまで。
- **監査ログ**（誰が誰の削除/降格を試みたか）— 監査ログ基盤未整備（TSK-24）。

### 完了条件

- [ ] 最後の admin の削除を試みると 409 が返る
- [ ] 最後の admin の降格を試みると 409 が返る
- [ ] 自分自身の削除を試みると 409 が返る
- [ ] `LastAdminConflictException` が新設されメッセージが統一されている
- [ ] `IUserRepository.countActiveAdmins()` が追加され実装されている
- [ ] 関連ユニットテストが追加され `pnpm --filter backend test` が緑
- [ ] `pnpm --filter backend build` が通る
- [ ] 設計ドキュメント・`AGENTS.md` 表更新

---

## 3. 詳細設計

### 3.1 `LastAdminConflictException`

新規ファイル: `backend/src/common/exceptions/last-admin-conflict.exception.ts`

```ts
import { ConflictException } from '@nestjs/common';

export class LastAdminConflictException extends ConflictException {
  constructor(message = '最後の admin は削除/降格できません') {
    super(message);
  }
}
```

- HTTP 409 を返す（`ConflictException` 継承）。
- メッセージ文言は呼び出し側で必要なら差し替え可能（自身削除など）。

### 3.2 `IUserRepository.countActiveAdmins()`

`backend/src/user/domain/user.repository.ts` にメソッドを追加：

```ts
countActiveAdmins(): Promise<number>;
```

- `softDelete` 済みは除外（TypeORM のデフォルト挙動）。
- `role = admin` の件数を返す。

実装（`backend/src/user/infra/user.repository.impl.ts`）：

```ts
async countActiveAdmins(): Promise<number> {
  return this.repo.count({ where: { role: UserRole.Admin } });
}
```

### 3.3 `UserService.remove(id, actorId)`

シグネチャ変更: 第 2 引数に `actorId: string` を追加。

```ts
async remove(id: string, actorId: string): Promise<void> {
  if (id === actorId) {
    throw new LastAdminConflictException('自分自身は削除できません');
  }

  const user = await this.findById(id);

  if (user.role === UserRole.Admin) {
    const adminCount = await this.userRepository.countActiveAdmins();
    if (adminCount <= 1) {
      throw new LastAdminConflictException();
    }
  }

  await this.userRepository.softDelete(id);
  // 既存: globalSignOut → disableUser
  // ...
}
```

ロジック順序:

1. 自身チェック → 409
2. 対象取得（404）
3. 対象が admin かつ admin 数 1 → 409
4. 既存の削除フロー（softDelete → globalSignOut → disableUser）

> 補足: 「対象が admin」の判定は `findById` 後の `user.role` でよい。`countActiveAdmins()` 呼び出しは admin 削除のときのみ。

### 3.4 `UserService.update(id, input)`

シグネチャ変更なし。`role` 降格チェックを追加。

```ts
async update(id: string, input: UpdateUserInput): Promise<User> {
  const user = await this.findById(id);

  if (
    input.role !== undefined &&
    user.role === UserRole.Admin &&
    input.role !== UserRole.Admin
  ) {
    const adminCount = await this.userRepository.countActiveAdmins();
    if (adminCount <= 1) {
      throw new LastAdminConflictException();
    }
  }

  // 既存の代入処理
  // ...
}
```

ロジック順序:

1. 対象取得（404）
2. role 変更が `admin → 非 admin` で、かつ admin 数 1 → 409
3. 既存の代入 + save

### 3.5 Controller の対応

`UserController.remove` は `actor.userId` を service に渡す形に修正：

```ts
@Delete(':id')
@Roles(UserRole.Admin)
@HttpCode(204)
async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
  const actor = requireAuthUser(req);
  await this.userService.remove(id, actor.userId);
}
```

`update` は signature 変更なし。

### 3.6 トランザクション境界

最後 admin 判定は **読み取り** のみ（`countActiveAdmins`）。アプリ層チェックの直後に softDelete / save が走るが、Notion チケット原文どおり厳密なレース対策は対象外。`docs/00_rules.md §4` の「DB UPDATE → 外部 API → COMMIT」原則は変更系の整合性に関するもので、本タスクの「事前カウントチェック」には適用されない。

理論上のレース: 同時に 2 人の admin を削除しに来た場合、両方とも `countActiveAdmins() = 2` を見て両方の削除が成功し、結果的に admin 0 人になる可能性がある。本タスクではこのレースは許容（管理者が同時操作する状況は実運用ではほぼなく、対策コストが見合わない）。リスクとして §6 に明記。

---

## 4. 影響範囲

| 種別 | パス | 変更概要 |
| --- | --- | --- |
| backend | `src/common/exceptions/last-admin-conflict.exception.ts` | 新規 |
| backend | `src/user/domain/user.repository.ts` | `countActiveAdmins()` を追加 |
| backend | `src/user/infra/user.repository.impl.ts` | `countActiveAdmins()` 実装 |
| backend | `src/user/application/user.service.ts` | `remove(id, actorId)` シグネチャ変更、`update` に降格チェック追加 |
| backend | `src/user/controller/user.controller.ts` | `remove` で actor の userId を service に渡す |
| backend (test) | `src/user/application/user.service.spec.ts` | `remove` / `update` の最後 admin 系テストを追加。既存テストの `service.remove(id)` を `service.remove(id, otherActorId)` に揃える |
| docs | `docs/26_last-admin-protection.md` | 本書（新規） |
| docs | `AGENTS.md` | ドキュメント表に追記 |

migration / `.env.example` / フロントエンドの変更は **なし**。

---

## 5. 動作確認

### 5.1 自動テスト

- `UserService.remove`:
  - (a) 自身削除（`id === actorId`）で `LastAdminConflictException`
  - (b) 対象が admin、admin 数 1 で `LastAdminConflictException`
  - (c) 対象が admin、admin 数 ≥ 2 なら通常削除フロー実行
  - (d) 対象が user なら `countActiveAdmins` を呼ばず通常削除
  - (e) 既存テスト（softDelete → globalSignOut → disableUser の順、各種失敗時の挙動）を維持
- `UserService.update`:
  - (f) 対象 admin → user 降格、admin 数 1 で `LastAdminConflictException`
  - (g) 対象 admin → user 降格、admin 数 ≥ 2 なら成功
  - (h) 対象 user → admin 昇格は admin 数を見ずに成功
  - (i) role 変更なしの更新では `countActiveAdmins` を呼ばない

### 5.2 手動シナリオ

1. admin 1 名のみの状態で `DELETE /users/<その admin の id>` → 409
2. admin 1 名のみの状態で `PATCH /users/<その admin の id>`（role: user） → 409
3. admin 2 名にして 1 名の `DELETE` → 200 / 204、その後の admin 数 1
4. admin 2 名にして 1 名の `PATCH`（user 降格） → 200、その後の admin 数 1
5. admin で自身を `DELETE /users/<self id>` → 409
6. user ロールで `DELETE /users/<other>` → 403（既存の RolesGuard）

---

## 6. リスク・補足

- **レースコンディション**: 同時並行で複数 admin の削除/降格が走った場合、両方とも事前カウントを通過してしまう可能性がある。本タスクではアプリ層チェックに留める（Notion で許容）。実運用で問題が顕在化した場合は別タスクで `SELECT ... FOR UPDATE` 等のロックを検討。
- **自身の admin → user 降格**: 本タスクでは拒否しない。最後の admin であれば §2 の (2) で弾かれるため、最低限のセーフティは確保される。
- **既存 `remove` テストの更新**: シグネチャ変更により既存 spec の `service.remove(id)` を `service.remove(id, '<別のユーザー id>')` に直す必要がある。リファクタとしてヘルパーで第 2 引数を吸収する形にして影響を局所化する。
- **メッセージ文言**: 「最後の admin は削除/降格できません」「自分自身は削除できません」の 2 種を `LastAdminConflictException` のコンストラクタ引数で切り替え。フロント側の表示はそのまま使える日本語にする。
