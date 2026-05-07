# Petal - ロール認可基盤（DB lookup + GET /users/me） 設計

対応タスク: **TSK-10「ロール変更時の Cognito グループ連携」**

> 📌 **設計方針の経緯**: Notion チケットでは Cognito グループとの同期方式（JWT の `cognito:groups` を使う案）が提示されていたが、検討の結果 **DB を単一の真実とし、AuthGuard で DB lookup する方式** に切り替えた。理由は本書 §1.2 を参照。タスクのタイトルは Notion 側の文言を踏襲しているが、実際には **「ロール認可基盤の整備」** が本タスクの本質である。

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — ユーザー情報・認証 設計
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — ユーザー管理機能 拡張設計

---

## 1. スコープと方針

### 1.1 対象

1. **`JwtAuthGuard` を拡張**し、JWT 検証成功後に `cognito_sub` で DB から `User` を引いて `request.user.role` / `request.user.userId` をセットする。
2. **`@Roles('admin')` デコレータと `RolesGuard`** を追加し、ロールベース認可をデコレータで宣言できるようにする。
3. **`GET /users/me`** を追加し、フロントエンドが自身の role を含むプロフィールを取得できるようにする。
4. 既存 Controller で `resolveCurrentUser` 等を使っている箇所を、Guard でセットした `request.user` に寄せる（最小限の整理）。
5. ドキュメント更新（[11_](11_user-info_and_authentication.md) の AuthGuard 節 / [AGENTS.md](../AGENTS.md) のドキュメント表）。

### 1.2 非対象（特に Cognito グループ同期）

- **Cognito User Pool のグループ機能は使わない**。
  - ユーザーロールは **DB（`users.role`）が単一の真実**。Cognito 側にコピーを持たない。
  - Notion チケット原文の「`AdminAddUserToGroup` / `AdminRemoveUserFromGroup` で同期」「JWT の `cognito:groups` を読む」は **本タスクでは採用しない**。
- 削除済みユーザーの復活時のロール再設定（DB 側の `role` は softDelete でも残るため追加対応不要）。
- フロント UI のロール表示（一覧の列追加など）は本タスクでは触らない（`GET /users/me` の追加のみ）。
- 細粒度パーミッション（Permission レベルの認可）。本タスクは **role の 2 値（`admin` / `user`）による粗粒度認可** に留める。
- ロール別の具体的な API 認可ルールの**全面適用**は別タスク。本タスクでは `RolesGuard` の仕組みを用意し、**動作確認のために最低 1 つの管理 API（後述 `POST /users` 等）に `@Roles('admin')` を付与する** ところまで行う。残りの API への適用は段階的に。

### 1.3 設計判断の理由（なぜ Cognito グループ案を採らなかったか）

| 観点 | Cognito グループ同期案（A） | DB lookup 案（B＝採用） |
| ---- | --------------------------- | ----------------------- |
| 真実の所在 | DB（同期コピーが Cognito） | DB のみ |
| 整合性 | 同期窓・ドリフト監査が必要 | 単一の真実、整合性問題なし |
| ロール変更の反映 | 次のトークン発行（Access Token TTL 1h、最悪リフレッシュトークン期限まで）まで遅延 | 次のリクエストで即時反映 |
| 即時降格 / BAN | 別途 `GlobalSignOut` が必要 | DB 更新だけで完結 |
| 性能 | DB 引かない | 認証付きリクエストごとに `users` を `cognito_sub` で 1 回引く（UNIQUE index、極軽量） |
| 実装・運用コスト | 高（補償・移行・監査スクリプト） | 低 |

Petal の現状規模（admin 1 名 + 数名 user）と「整合性が取りにくい」という Notion 側の懸念を踏まえ、**B 案の方が懸念をそのまま解消できる**ため採用した。

### 1.4 Notion チケット完了条件との対応

Notion チケットの完了条件「役割の同期」が指す目的は **「バックエンドが認可判定で role を参照できる」** ことだと解釈し、それを DB lookup で達成する。

| Notion 完了条件原文 | 本設計での対応 |
| ------------------- | -------------- |
| role 変更で Cognito グループが追従する | **対応しない**（Cognito グループ自体を使わない）。代わりに、DB.role の更新が次リクエストの認可判定に即時反映されることで目的を達成。 |
| 新規登録でグループが付与される | **対応しない**（同上）。代わりに DB 登録のみで認可判定に十分。 |
| JWT に `cognito:groups` が入り、AuthGuard で参照できる | **対応しない**。代わりに `JwtAuthGuard` が DB lookup で `request.user.role` をセットし、`RolesGuard` がそれを参照する。 |

> Notion チケットのコメント or クローズ時に、本設計判断の経緯を残すことを推奨する（運用上の申し送り）。

### 1.5 完了条件（再定義）

- [ ] **AuthGuard の DB 連携**
  - [ ] `JwtAuthGuard` が JWT 検証成功後に `cognito_sub` で DB を引く
  - [ ] 該当ユーザーが存在しない / 削除済み（`deletedAt !== null`）の場合は `401 Unauthorized`
  - [ ] `request.user` に `{ sub, userId, email, role }` がセットされる
- [ ] **ロールベース認可**
  - [ ] `@Roles('admin')` デコレータが追加されている
  - [ ] `RolesGuard` がグローバル登録され、デコレータ未指定のエンドポイントは素通りする
  - [ ] `POST /users` / `PATCH /users/:id` / `DELETE /users/:id` / `POST /users/:id/restore` / `GET /users` （管理操作系）に `@Roles('admin')` が付与されている
- [ ] **`GET /users/me`**
  - [ ] 認証必須。`request.user.userId` を起点に DB から取得し、既存 `UserResponseDto` 形式で返す
  - [ ] `me/email` 系 API と URL 衝突しない（`@Get('me')` を `@Patch('me/email')` 等より前に置く / Nest のルーティング規則を確認）
- [ ] **既存 Controller の整理**
  - [ ] `UserController.resolveCurrentUser` を撤去し、`request.user` を直接参照する形に書き換え
  - [ ] `extractCognitoSub` 等のローカルヘルパーも撤去（Guard でセット済みのため）
- [ ] **テスト時挙動**
  - [ ] `SKIP_AUTH=true` のとき、固定の admin ダミーユーザー（DB から引く or 環境変数で指定）を `request.user` にセット
- [ ] **ドキュメント反映**
  - [ ] `docs/11_user-info_and_authentication.md` の AuthGuard 節に DB lookup 仕様を追記
  - [ ] `AGENTS.md` のドキュメント表に本書を追記

---

## 2. 既存実装の現状（差分把握用）

| 項目 | 現状 | 本タスクでの変更 |
| ---- | ---- | ---------------- |
| `JwtAuthGuard` | JWT 検証のみ。`request.user` に Cognito JWT のペイロードを生でセット | DB lookup を追加し、`request.user.role` / `userId` / `email` をセット。削除済みユーザーは弾く |
| Controller の `req.user.sub` 抽出 | 各 Controller でヘルパー関数 `extractCognitoSub` を実装 | Guard で正規化された `request.user` を直接参照（型は `AuthUser`） |
| `UserController.resolveCurrentUser` | `me/email` 系で sub → DB lookup を毎回実行 | Guard 側で済ませるため撤去 |
| `RolesGuard` / `@Roles` デコレータ | 存在しない | 新規追加。`APP_GUARD` でグローバル登録 |
| `GET /users/me` | 存在しない | 新規追加 |
| Cognito User Pool | グループ未使用（前提） | **変更なし**（グループは作らない・使わない） |
| IAM 権限 | 既存のまま | **変更なし**（グループ操作系の権限は追加しない） |

---

## 3. 詳細設計

### 3.1 共通型 `AuthUser`

ファイル: `backend/src/common/types/auth-user.ts`

```ts
import { UserRole } from '../../user/domain/user-role.enum';

export type AuthUser = {
  sub: string;        // Cognito の sub（JWT クレーム）
  userId: string;     // Petal の users.id（UUID）
  email: string;
  role: UserRole;
};

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
```

- Express の `Request` 型に `user?: AuthUser` を宣言マージし、Controller 側で `(req as ...)` キャストを不要にする。
- 既存の `req['user']` 系アクセスはこの型に置き換える。

### 3.2 `JwtAuthGuard` の拡張

ファイル: `backend/src/common/guards/jwt-auth.guard.ts`

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    config: ConfigService,
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) { /* ... */ }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() なら素通り
    // 2. SKIP_AUTH=true ならテスト用ダミーをセット（§3.5）
    // 3. JWT を verify
    // 4. payload.sub で userRepository.findByCognitoSub を呼ぶ
    //    - 見つからない / deletedAt !== null → 401
    // 5. request.user = { sub, userId, email, role } をセット
  }
}
```

依存方向: Guard（Infrastructure 寄りの横断的関心事）が `IUserRepository`（Domain インターフェース）に依存するのは許容範囲（外側 → 内側）。

### 3.3 `RolesGuard` と `@Roles` デコレータ

ファイル:

- `backend/src/common/decorators/roles.decorator.ts`
- `backend/src/common/guards/roles.guard.ts`

```ts
// roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // ロール指定なしは素通り

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) throw new ForbiddenException('認可情報がありません');
    if (!required.includes(user.role)) {
      throw new ForbiddenException('権限がありません');
    }
    return true;
  }
}
```

`AppModule` で `APP_GUARD` として `JwtAuthGuard` の **後** に登録する（NestJS の Provider 登録順がそのまま実行順になる）。

```ts
// app.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

### 3.4 `GET /users/me`

`UserController` に下記エンドポイントを追加。

```text
GET /users/me
Authorization: Bearer <token>

Response 200: UserResponseDto（既存 DTO をそのまま返す）

Errors:
  401 — 未認証 / 削除済み（Guard で処理）
```

実装上の注意:

- Nest の Controller 内では **静的パス（`me`）を動的パス（`:id`）より前に宣言**することでルーティング衝突を避ける（既存の `me/email` 系と同じ位置）。
- `@Roles` は付けない（自分のプロフィール参照は全ロールで可）。
- Service には `findByIdOrThrow` 既存メソッドを流用。

### 3.5 `SKIP_AUTH=true` 時の挙動

現状はダミー `{ sub: 'test-user' }` を入れているのみ。`AuthUser` 全体を満たすダミーが必要。

方針: 環境変数 `SKIP_AUTH_USER_ID` を任意で受け、指定があれば DB から実ユーザーを引いてセット。指定がなければ `cognito_sub = 'test-user'` で DB を引く（既存テスト admin の sub を入れておく前提）。両方失敗したら `401`。

これにより、ローカルでロール挙動をテストするときは `SKIP_AUTH_USER_ID=<対象 user の id>` を切り替えるだけで挙動を確認できる。

```ts
if (this.skipAuth) {
  const target = config.get('SKIP_AUTH_USER_ID');
  const user = target
    ? await this.userRepository.findById(target)
    : await this.userRepository.findByCognitoSub('test-user');
  if (!user) throw new UnauthorizedException('SKIP_AUTH 用ダミーユーザーが見つかりません');
  req.user = toAuthUser(user);
  return true;
}
```

### 3.6 既存 Controller の整理

[backend/src/user/controller/user.controller.ts](../backend/src/user/controller/user.controller.ts) の以下を整理する。

- `resolveCurrentUser(req)` → 撤去。代わりに `req.user`（`AuthUser`）を直接使う。
- `extractCognitoSub` → 撤去（Guard 側で完結）。
- `extractBearer` → **そのまま残す**。`me/email` 系の `accessToken` は Cognito の `UpdateUserAttributes` / `VerifyUserAttribute` に渡すために必要で、これは認可ではなく Cognito SDK の引数なので Guard とは独立。

`UserService.requestEmailChange` / `confirmEmailChange` の引数 `actor: User` の渡し方は変えない。Controller で `req.user.userId` から `userService.findById(userId)` を呼んで `User` を取得する。

### 3.7 ロール認可の適用範囲（本タスクでの初期適用）

以下のエンドポイントに `@Roles(UserRole.Admin)` を付与する：

- `GET    /users`           （ユーザー一覧）
- `GET    /users/:id`       （他ユーザー詳細）— ただし `/me` は除外する位置に配置
- `POST   /users`
- `PATCH  /users/:id`
- `DELETE /users/:id`
- `POST   /users/:id/restore`

以下は付与しない（自分自身に対する操作）：

- `GET    /users/me`
- `PATCH  /users/me/email`
- `POST   /users/me/email/verify`

その他のフィーチャ（`auth/*`、`image/*` 等）への `@Roles` 付与は別タスク。本タスクでは「仕組みが入っていることの動作確認」が目的。

---

## 4. データモデル / マイグレーション

DB スキーマの変更は **不要**。既存の `users.role` をそのまま使う。

---

## 5. 環境変数 / IAM 権限

### 5.1 環境変数

- `SKIP_AUTH_USER_ID`（任意）— `SKIP_AUTH=true` のときに使うダミーユーザーの DB id を指定。未指定なら `cognito_sub = 'test-user'` で DB を引く。`.env.example` に追記。

### 5.2 IAM 権限

**追加なし**。Cognito グループ操作系のアクションは使わない。

---

## 6. 主要ファイル変更一覧

### Backend

| ファイル | 変更概要 |
| -------- | -------- |
| `backend/src/common/types/auth-user.ts` | 新規。`AuthUser` 型と Express `Request` の型拡張 |
| `backend/src/common/guards/jwt-auth.guard.ts` | DB lookup を追加、`request.user` を `AuthUser` に正規化、削除済み弾き、`SKIP_AUTH` ダミーの拡充 |
| `backend/src/common/guards/roles.guard.ts` | 新規 |
| `backend/src/common/decorators/roles.decorator.ts` | 新規 |
| `backend/src/app.module.ts` | `APP_GUARD` に `RolesGuard` を追加登録 |
| `backend/src/user/user.module.ts` | `IUserRepository` を Guard から使えるよう公開（既に exports 済みなら変更なし） |
| `backend/src/user/controller/user.controller.ts` | `GET /users/me` 追加。`resolveCurrentUser` / `extractCognitoSub` 撤去。`@Roles(Admin)` 付与 |
| `backend/.env.example` | `SKIP_AUTH_USER_ID` 追加 |

### Docs

| ファイル | 変更概要 |
| -------- | -------- |
| `docs/11_user-info_and_authentication.md` | §5.5 AuthGuard 節に「DB lookup で role / userId をセット」「`@Roles` / `RolesGuard`」「削除済みユーザーは 401」を追記。§3 ロール表に「DB が単一の真実」と明記 |
| `AGENTS.md` | ドキュメント表に本書を追記 |

### Frontend

変更なし（`GET /users/me` は OpenAPI 経由で型生成されるが、UI 利用は別タスク）。

---

## 7. 手動動作確認シナリオ

PR 本文のチェックリストに転記する。

- [ ] admin ユーザーでログイン → `GET /users/me` が `role: "admin"` を返す
- [ ] admin ユーザーで `GET /users` が 200 を返す
- [ ] user ユーザーを新規登録（admin として `POST /users` で作成）→ そのユーザーでログイン → `GET /users/me` が `role: "user"` を返す
- [ ] user ユーザーで `GET /users` を呼ぶ → `403 Forbidden`
- [ ] user ユーザーで `POST /users` を呼ぶ → `403 Forbidden`
- [ ] user ユーザーで `PATCH /users/me/email` は呼べる（自分の操作）
- [ ] admin で `PATCH /users/:id`（user → admin）でロール昇格 → 該当ユーザーが**再ログインせず**次リクエストで `GET /users` を呼ぶと 200（即時反映の確認）
- [ ] admin で `PATCH /users/:id`（admin → user）でロール降格 → 同様に即時 403
- [ ] admin で `DELETE /users/:id` → 該当ユーザーの既存トークンで API を叩くと `401`（Guard が deletedAt で弾く確認）
- [ ] `SKIP_AUTH=true` + `SKIP_AUTH_USER_ID=<admin user id>` でローカル起動 → `GET /users` が通ること
- [ ] `pnpm --filter backend build` が通る

---

## 8. リスク・補足

- **AuthGuard が DB を毎リクエスト引く**: `cognito_sub` UNIQUE index による単行 SELECT で十分軽量。将来ボトルネックになったら短時間（例: 30 秒）の in-memory cache を AuthGuard に追加する余地はあるが、本タスクでは入れない。
- **削除済みユーザーの 401 化**: 既存の挙動（JWT が有効な間は通っていた）から変わる。意図した動作だが、PR 本文の「補足 / 注意事項」に明記する。
- **`req.user` の型変更**: 現状 `req.user` を直接参照している箇所は `UserController.resolveCurrentUser` 経由のみ。他フィーチャでの参照がないことを実装時に grep で再確認。
- **Cognito グループを将来使う場合**: 別タスクで本書を上書きする。本書 §1.3 の表が判断材料として残る。

---

## 9. 完了条件チェックリスト

§1.5 と同じ。実装完了時にすべて埋める。

---

## 10. 未確定事項 / 将来検討

- 細粒度パーミッション（リソースごとの permission による認可）。
- Image / Auth フィーチャへの `@Roles` 適用範囲の精査。
- AuthGuard の DB lookup を短時間キャッシュするか（性能問題が見えてから判断）。
- セルフサービスサインアップ実装時の初期ロール（v1.1 以降）。
