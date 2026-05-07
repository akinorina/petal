# Petal - 監査ログ（ユーザー管理操作） 設計

対応タスク: **TSK-24「監査ログ（ユーザー管理操作）」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール（§4 DB ルール、§4.3 物理削除しない）
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — ユーザー管理操作（記録対象）
- [docs/21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) — `@Roles(Admin)` / RolesGuard
- [docs/24_testing-strategy.md](24_testing-strategy.md) — テスト方針

---

## 1. 背景

誰が・いつ・誰の・何を変更したかの記録がなく、トラブル時の追跡や運用監査ができない。Notion チケットの方針に従い「ユーザー管理操作」に絞って監査ログ基盤を整備する。

---

## 2. スコープと完了条件

### 対象

1. **`audit_logs` テーブルを新設**（migration ファイル）。
2. **`audit` フィーチャ** を新設（domain / application / infra / controller の 4 層）。
3. **`UserService` の主要操作で監査ログを記録**:
   - `CREATE_USER` （`POST /users`）
   - `UPDATE_USER` （`PATCH /users/:id`）
   - `DELETE_USER` （`DELETE /users/:id`）
   - `RESTORE_USER` （`POST /users/:id/restore`）
4. **`GET /audit-logs`**（`@Roles(Admin)`）を実装。ページング付きで一覧取得。
5. **管理画面に閲覧ページ**（`frontend/app/audit-logs/page.tsx`）を実装。読み取り専用の表形式。
6. **監査ログ自体は変更/削除不可**（追記のみ）。`@DeleteDateColumn` を持たず、UPDATE / DELETE 系 API も提供しない。
7. ユニットテスト: `AuditLogService` と `UserService` の連動部分。

### 非対象（別タスク化）

- **画像など他フィーチャの監査**（`image` 等）。Notion チケット原文「まずユーザー管理操作のみを対象とし、画像など他フィーチャは別タスクで段階追加」の通り。
- **`FORCED_LOGOUT` を独立アクションとして記録すること**。本タスクでは `DELETE_USER` の付随情報として metadata に含める方針（§3.3 参照）。
- **セルフサービス操作**（自分の email 変更、パスワード変更、パスワードリセット）。Notion チケットは「ユーザー管理操作」の範囲を admin による他者の操作に限定。
- **検索 / フィルタ UI**（actor / action / 期間で絞り込む）。一覧 + ページングのみ。
- **CSV エクスポート**。
- **監査ログのリテンション・自動削除**。仕様未定。

### 完了条件

- [ ] `audit_logs` テーブルが migration で作成される（`pnpm migration:run` 成功）
- [ ] User CRUD 系操作（CREATE / UPDATE / DELETE / RESTORE）が `audit_logs` に残る
- [ ] `GET /audit-logs` が admin のみアクセス可・ページング対応
- [ ] フロント `/audit-logs` ページで一覧を参照できる（admin のみ）
- [ ] 監査ログ自体は変更/削除できない（API・ORM ともに更新系を提供しない）
- [ ] パスワード等の機微情報を記録しない
- [ ] `pnpm --filter backend test` が緑（既存 + 新規）
- [ ] `pnpm --filter backend build` / `pnpm --filter frontend build` が通る
- [ ] OpenAPI を再生成
- [ ] 設計ドキュメント・`AGENTS.md` 表更新

---

## 3. データモデル

### 3.1 DB スキーマ

```sql
CREATE TYPE "petal"."audit_action" AS ENUM (
  'CREATE_USER',
  'UPDATE_USER',
  'DELETE_USER',
  'RESTORE_USER'
);

CREATE TABLE "petal"."audit_logs" (
  "id"             UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id"  UUID                  NOT NULL,
  "action"         "petal"."audit_action" NOT NULL,
  "target_user_id" UUID,                 -- 対象ユーザー（任意。CREATE_USER は対象自身を指す）
  "metadata"       JSONB,                -- 操作詳細（before/after、付随情報）
  "created_at"     TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_audit_logs_actor"  FOREIGN KEY ("actor_user_id")  REFERENCES "petal"."users"("id"),
  CONSTRAINT "FK_audit_logs_target" FOREIGN KEY ("target_user_id") REFERENCES "petal"."users"("id")
);

CREATE INDEX "IDX_audit_logs_created_at" ON "petal"."audit_logs" ("created_at" DESC);
CREATE INDEX "IDX_audit_logs_target"     ON "petal"."audit_logs" ("target_user_id");
CREATE INDEX "IDX_audit_logs_actor"      ON "petal"."audit_logs" ("actor_user_id");
```

ポイント:

- **`deleted_at` を持たない**: 監査ログは追記のみ。物理削除も論理削除も行わない。設計ルール §4.3「論理削除」の例外として本書で明記。
- **FK に `ON DELETE` 指定なし**: `users` は softDelete のみで物理削除されないため、参照整合性が壊れることはない。仮に運用で物理削除する場合は別途検討。
- **`metadata` は JSONB**: スキーマレスで操作ごとの詳細を保持。
- **インデックス**: `created_at DESC` で一覧の時系列ソート、`target_user_id` で「特定ユーザーへの操作履歴」検索を想定（本タスクでは UI 露出しないが将来用）。

### 3.2 ドメインエンティティ

```ts
// audit/domain/audit-action.enum.ts
export enum AuditAction {
  CreateUser = 'CREATE_USER',
  UpdateUser = 'UPDATE_USER',
  DeleteUser = 'DELETE_USER',
  RestoreUser = 'RESTORE_USER',
}

// audit/domain/audit-log.ts
import { z } from 'zod';
import { AuditAction } from './audit-action.enum';

export const AuditLogSchema = z.object({
  id: z.uuid(),
  actorUserId: z.uuid(),
  action: z.enum(AuditAction),
  targetUserId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export type AuditLogProps = z.infer<typeof AuditLogSchema>;

export class AuditLog {
  // 既存 User と同形式: コンストラクタで parse + プロパティ代入
}
```

`docs/00_rules.md §1` のドメインエンティティ規約（Zod スキーマ + コンストラクタ parse）に揃える。

### 3.3 Action と metadata 設計

| Action | 発火元 | actor | target | metadata 例 |
| --- | --- | --- | --- | --- |
| `CREATE_USER` | `POST /users` | 操作 admin | 新規作成された user | `{ email, role, name }` |
| `UPDATE_USER` | `PATCH /users/:id` | 操作 admin | 更新対象 | `{ changes: { role: { before, after }, name: { before, after } } }`（実際に変わった項目のみ） |
| `DELETE_USER` | `DELETE /users/:id` | 操作 admin | 削除対象 | `{ targetEmail, forcedLogout: true }`（globalSignOut 成功時 true、失敗時 false） |
| `RESTORE_USER` | `POST /users/:id/restore` | 操作 admin | 復元対象 | `{ targetEmail }` |

**機微情報の扱い**:

- パスワード・session・refresh token・access token は metadata に **絶対に含めない**。
- email はログに残す（運用上必須）。

---

## 4. アーキテクチャ

### 4.1 フィーチャ構成

```
backend/src/audit/
  domain/
    audit-action.enum.ts
    audit-log.ts
    audit-log.repository.ts        # IAuditLogRepository + AUDIT_LOG_REPOSITORY シンボル
  application/
    audit-log.service.ts            # record(input) と find(pagination)
    audit-log.schemas.ts            # ListAuditLogsQuerySchema 等
    audit-log.service.spec.ts
  infra/
    audit-log.entity.ts             # TypeORM
    audit-log.repository.impl.ts
  controller/
    audit-log.controller.ts         # GET /audit-logs
    audit-log.dto.ts
  audit.module.ts
```

### 4.2 `AuditLogService.record(input)`

```ts
type RecordAuditLogInput = {
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
};

async record(input: RecordAuditLogInput): Promise<void> {
  const log = new AuditLog({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  });
  await this.auditLogRepository.save(log);
}
```

例外時の挙動: 監査ログ書き込み失敗で **本体操作を巻き戻さない**。記録は best-effort で、失敗は WARN ログのみ。理由:

- 本体操作（user 削除など）は外部 API（Cognito）も伴うため、監査ログだけのために整合性を壊すリスクを背負わない。
- 失敗時は Logger に吐かれ、運用で気づける。

### 4.3 `UserService` の改修

各操作の **成功後** に `auditLogService.record()` を呼ぶ。例外時は記録しない（操作が失敗した記録は残さない）。

```ts
// create
const created = await this.userRepository.save(user);
await this.recordAudit(actor.id, AuditAction.CreateUser, created.id, {
  email: created.email,
  role: created.role,
  name: created.name,
});
return created;

// update
const before = { name: user.name, nameKana: user.nameKana, role: user.role };
// ... 既存の代入処理 ...
const saved = await this.userRepository.save(user);
const changes = computeChanges(before, saved);
if (Object.keys(changes).length > 0) {
  await this.recordAudit(actor.id, AuditAction.UpdateUser, saved.id, { changes });
}
return saved;

// remove (softDelete + globalSignOut + disableUser の後)
let forcedLogout = true;
try {
  await this.cognitoUser.globalSignOut(user.email);
} catch { forcedLogout = false; ... }
// ...
await this.recordAudit(actor.id, AuditAction.DeleteUser, id, {
  targetEmail: user.email,
  forcedLogout,
});

// restore
await this.recordAudit(actor.id, AuditAction.RestoreUser, id, {
  targetEmail: user.email,
});
```

シグネチャ変更:

| メソッド | 変更前 | 変更後 |
| --- | --- | --- |
| `create(input)` | `create(input)` | `create(input, actorId)` |
| `update(id, input)` | `update(id, input)` | `update(id, input, actorId)` |
| `remove(id, actorId)` | （TSK-16 で actor は受け取り済み） | 変更なし |
| `restore(id)` | `restore(id)` | `restore(id, actorId)` |

Controller 側で `requireAuthUser(req).userId` を取得して service に渡す形に揃える（`remove` で既に確立されたパターン）。

### 4.4 `AuditLogController`

```ts
@ApiTags('audit-logs')
@ApiBearerAuth('bearer')
@Controller('audit-logs')
@Roles(UserRole.Admin)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<ListAuditLogsResponseDto> {
    const parsed = ListAuditLogsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.auditLogService.findAll(parsed.data);
  }
}
```

レスポンス形式（一覧と total を返す ― ページング UI 用）:

```ts
{
  items: AuditLogResponseDto[];
  total: number;
  limit: number;
  offset: number;
}
```

クエリパラメータ:

- `limit` — 既定 20、最大 100
- `offset` — 既定 0

### 4.5 リポジトリ実装

```ts
// audit/infra/audit-log.repository.impl.ts
async findAll(limit: number, offset: number): Promise<{ items: AuditLog[]; total: number }> {
  const [entities, total] = await this.repo.findAndCount({
    order: { createdAt: 'DESC' },
    take: limit,
    skip: offset,
  });
  return { items: entities.map((e) => this.toDomain(e)), total };
}

async save(log: AuditLog): Promise<void> {
  await this.repo.save(this.toEntity(log));
}
```

`update` / `delete` メソッドは **実装しない**（インターフェースにも定義しない）。これにより「追記のみ」を型レベルで担保。

---

## 5. Frontend 詳細設計

### 5.1 API hook

`frontend/lib/api-hooks/use-audit-logs-api.ts` 新規。`apiClient.GET('/audit-logs', { params: { query: { limit, offset } } })` を呼ぶ取得フックを定義。

### 5.2 ページ

`frontend/app/audit-logs/page.tsx` + `use-audit-logs-page.ts` のセットを既存パターン（`docs/00_rules.md §3 Frontend ページ構成`）に倣って実装。

UI:

- 表形式（`created_at`、`action`、`actor` ID/email、`target` ID/email、`metadata` JSON）
- ページング（前へ / 次へ ボタン）
- admin のみアクセス可（既存 `useAuth` で role を見る or AuthGuard が backend で 403 を返すのでそれを表示）

actor/target の email を一覧で出すには join が必要。本タスクでは **id のみ表示** とし、必要なら別タスクで join 実装。metadata に target email を入れているケースが多いので、ユーザー名で確認したい場合は metadata 列で代替可能。

### 5.3 ナビゲーション

ヘッダーやサイドメニューに「監査ログ」リンクを追加（admin のみ表示）。既存のメニュー実装に倣う。

---

## 6. 影響範囲

### Backend

| ファイル | 変更概要 |
| --- | --- |
| `backend/database/migrations/<ts>-CreateAuditLogsTable.ts` | 新規 |
| `backend/src/audit/...` | フィーチャ一式（新規） |
| `backend/src/user/application/user.service.ts` | actor 受け取り + AuditLogService 呼び出し |
| `backend/src/user/application/user.service.spec.ts` | spec 更新（actor 引数 + audit log 呼び出し検証） |
| `backend/src/user/controller/user.controller.ts` | `create` / `update` / `restore` で actorId を渡す |
| `backend/src/user/user.module.ts` | `AuditModule` を import |
| `backend/src/app.module.ts` | `AuditModule` を import |
| `backend/openapi.json` | 自動再生成 |

### Frontend

| ファイル | 変更概要 |
| --- | --- |
| `frontend/app/audit-logs/page.tsx` | 新規ページ |
| `frontend/app/audit-logs/use-audit-logs-page.ts` | ページフック |
| `frontend/lib/api-hooks/use-audit-logs-api.ts` | API フック |
| `frontend/lib/openapi/schema.d.ts` | OpenAPI 再生成 |
| ヘッダー / サイドメニュー | 「監査ログ」リンク追加（admin のみ表示） |

### Docs

| ファイル | 変更概要 |
| --- | --- |
| `docs/28_audit-logs.md` | 本書（新規） |
| `AGENTS.md` | ドキュメント表に追記 |

migration 必須、`.env.example` 変更なし、Cognito User Pool 設定変更なし。

---

## 7. 手動動作確認シナリオ

PR 本文のチェックリストに転記する。

- [ ] migration 実行で `audit_logs` テーブルができる
- [ ] admin で `POST /users` → audit_logs に `CREATE_USER` 行が増える
- [ ] admin で `PATCH /users/:id`（role 変更） → `UPDATE_USER`、metadata に before/after が入る
- [ ] admin で `DELETE /users/:id` → `DELETE_USER`、metadata.forcedLogout=true
- [ ] admin で `POST /users/:id/restore` → `RESTORE_USER`
- [ ] user で `GET /audit-logs` → 403
- [ ] admin で `GET /audit-logs?limit=10&offset=0` → 200、items / total が返る
- [ ] フロント `/audit-logs` ページで一覧が見える（admin）
- [ ] フロント `/audit-logs` を user で開くと AuthGuard or RolesGuard で弾かれる（リダイレクトまたは 403 表示）
- [ ] パスワード変更後の audit_logs を確認 → セルフサービス系のレコードは作られない（記録対象外）
- [ ] backend / frontend ともに build 通過

---

## 8. リスク・補足

- **監査ログ書き込み失敗時の挙動**: best-effort で WARN ログのみ（§4.2）。「監査ログが落ちると業務が止まる」要件は本タスクでは採用しない。
- **物理削除しない例外**: `audit_logs` は `deleted_at` を持たず追記のみ。`docs/00_rules.md §4.3` に「監査ログは softDelete 不要 = 履歴として永続」と明記する追記を本タスクで行う。
- **users 物理削除と FK**: 現状 `users` は softDelete のみで物理削除されない。仮に物理削除を導入する場合は `audit_logs` の FK を `ON DELETE SET NULL` 等に変更する必要があるが、本リポジトリの方針的に発生しない想定。
- **本タスクでの actor 受け取り API 変更**: `create` / `update` / `restore` のシグネチャが変わる。テスト spec も同時に更新（既存 `create` テストは現状 `actorId` を渡していないため修正が入る）。
- **フロント admin 権限チェック**: 現状フロントには role ベースのページガードが無い。admin リンクはヘッダーで非表示にし、直接 URL を叩いた場合は backend 403 を表示する形に留める。完全なフロントガードは別タスクで対応。
