# Petal - テスト方針 設計

対応タスク: **TSK-28「ユーザー / 認証フィーチャのテスト整備」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール（本書で §8 を追記）
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/01_requirements.md](01_requirements.md) — 機能要件
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤（§7「テスト方針: 要議論」を本書で確定）
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — ユーザー管理拡張（テスト対象）
- [docs/19_password-reset.md](19_password-reset.md)・[docs/20_email-change-flow.md](20_email-change-flow.md)・[docs/23_user-token-revocation-on-delete.md](23_user-token-revocation-on-delete.md) — 既に実装済みでテスト対象になるユースケース

---

## 1. スコープと完了条件

### 対象

1. **テスト方針の確定**: レイヤー別の責務、使用フレームワーク、モック戦略、テスト配置ルールを `docs/00_rules.md` に追記する。
2. **User フィーチャのユニットテスト追加**: `UserService` の主要ユースケース（`create` / `update` / `restore` / `requestEmailChange` / `confirmEmailChange` / `findById` / `remove`）をカバー。`remove` は既存テストを維持・拡張する。
3. **Auth フィーチャのユニットテスト追加**: `AuthService` の主要ユースケース（`login` / `completeNewPassword` / `forgotPassword` / `confirmForgotPassword` / `logout`）をカバー。
4. **ローカル実行**: `pnpm --filter backend test` が全ユニットテストで緑になる。
5. **e2e ベース**: 既存の `test/app.e2e-spec.ts` は維持。新規 e2e は本タスクでは追加しない（§3.2 参照）。

### 非対象（別タスク化）

- **DB 実体を伴う統合テスト**（testcontainers / テスト用 schema）。Repository モックで十分にロジックを検証できる範囲を本タスクの守備範囲とし、Repository 実装そのもののテストはスコープ外。
- **Image フィーチャのテスト**。本タスクは User / Auth に限定（チケット文言どおり）。
- **CI への組み込み**。ローカル `pnpm --filter backend test` の緑化までを担保し、GitHub Actions などへの組み込みは別タスク。
- **カバレッジ目標値の設定**。実態が見えてから別タスクで決める。
- **フロントエンドのテスト**。本タスクは backend のみ。
- **Controller / Guard の単体テスト**。Controller は薄く、Service への委譲のみのため、Service テストでビジネスロジックを担保し Controller 単体テストは省略する（必要が生じたら別タスクで追加）。

### 完了条件

- [ ] `docs/00_rules.md` に §8「テスト方針」を追記し、レイヤー別の責務とモック戦略を明記。
- [ ] `docs/11_user-info_and_authentication.md` §7 の「テスト方針: 要議論」を「§8 を参照」へ更新。
- [ ] `UserService` の主要ユースケースをユニットテストでカバー（既存 `user.service.spec.ts` を拡張）。
- [ ] `AuthService` の主要ユースケースを新規 `auth.service.spec.ts` で網羅。
- [ ] `pnpm --filter backend test` がローカルで緑（既存 `app.controller.spec.ts` / `app.e2e-spec.ts` を含む）。
- [ ] `AGENTS.md` のドキュメント表に本書を追記。
- [ ] `pnpm --filter backend build` が通る。

---

## 2. 現状

| 項目 | 現状 |
| ---- | ---- |
| フレームワーク | Jest 30 + ts-jest（`backend/package.json` に既設） |
| HTTP 統合 | supertest（同上） |
| 既存ユニット | `src/app.controller.spec.ts`、`src/user/application/user.service.spec.ts`（`remove` のみ） |
| 既存 e2e | `test/app.e2e-spec.ts`（`AppController` の `/` のみ） |
| Cognito クライアント | 具象クラスのまま DI される（`CognitoAuthClient`・`CognitoUserClient`） |
| Repository | インターフェース（`IUserRepository`）＋ DI シンボル（`USER_REPOSITORY`）で抽象化済み。`useValue` でモック差替容易 |

`docs/11_user-info_and_authentication.md` §7 で「テスト方針: 要議論（別途決定）」のまま放置されており、本タスクで確定させる。

---

## 3. 方針（`docs/00_rules.md` §8 として追記する内容）

### 3.1 レイヤー別の責務

| レイヤー | テスト対象 | 種別 | 備考 |
| ---- | ---- | ---- | ---- |
| Domain | `User` / `Image` 等のエンティティ、`Zod` スキーマの不変条件 | ユニット（必要時） | 純粋関数。本タスクではサービスのテストで間接的にカバーされる範囲のみで可。 |
| Application | `*.service.ts`（ユースケース） | **ユニット（必須・本タスクの主戦場）** | Repository / SDK クライアントを DI モックで差し替え。 |
| Infra | TypeORM Repository 実装、AWS SDK ラッパー | スコープ外 | 別タスクで統合テスト方針を定める。 |
| Controller | `*.controller.ts` | スコープ外 | 薄く、Service の委譲が主。Service テストで担保。 |
| Cross-cutting | `JwtAuthGuard` / `RolesGuard` | スコープ外 | 既存 e2e の `app.e2e-spec.ts` は維持。専用テストは別タスク。 |

### 3.2 モック戦略

- **Repository**: `IUserRepository` インターフェース + DI シンボル（`USER_REPOSITORY`）を `useValue` でモック。型安全のため `jest.Mocked<IUserRepository>` を活用。
- **Cognito クライアント**: 具象クラス（`CognitoAuthClient` / `CognitoUserClient`）を `useValue` でモック。**インターフェース化はしない**（既に DI コンテナ経由で差替可能であり、抽象化を増やすメリットが小さい）。例外判定メソッド（`isUserNotFound` 等）も spec 側でモック実装する。
- **`runInTransaction`**: モック実装で `fn(repo)` を即時実行する形（DB トランザクション境界はユニットでは検証しない）。
- **時刻**: 必要に応じて `jest.useFakeTimers()` / `Date` 固定。本タスクでは `new Date('2026-...')` 直書きで十分。

### 3.3 テスト配置と命名

- **ユニットテスト**: 対象ファイルと **同居** し `<file>.spec.ts` 命名（例: `user.service.ts` ↔ `user.service.spec.ts`）。
- **e2e テスト**: `backend/test/*.e2e-spec.ts`。Jest 設定が分かれている。
- **describe**: クラス名 + メソッド名（例: `UserService.create`）。
- **it**: 日本語で振る舞いを記述（既存 `user.service.spec.ts` に倣う）。

### 3.4 認証スキップ

- 既存設計どおり `SKIP_AUTH=true` のときガードをスキップ（[docs/11_*.md](11_user-info_and_authentication.md) §5.5）。
- ユニットテストは Service 層に閉じるためガードは関与しない。
- e2e で必要になれば `process.env.SKIP_AUTH = 'true'` を `beforeAll` で設定する形を共通化する（本タスクでは未対応・別タスク）。

### 3.5 カバレッジ

- 本タスクではカバレッジ目標を設定しない（`pnpm test:cov` は使うが閾値は設けない）。
- 「主要ユースケースが書かれているか」を完了条件とする。

---

## 4. 追加するテスト

### 4.1 `UserService`

既存の `src/user/application/user.service.spec.ts` を拡張。`describe('UserService')` 配下に以下を追加する。

| メソッド | ケース |
| ---- | ---- |
| `create` | (a) 正常系: Cognito 登録 → DB save が成功し User を返す<br>(b) 既存 email で `ConflictException`<br>(c) Cognito 失敗（`UsernameExistsException`）で `ConflictException`<br>(d) Cognito 失敗（その他）で `BadGatewayException`<br>(e) DB save 失敗で Cognito 補償削除が呼ばれ、元の例外を再 throw |
| `update` | (a) `name` / `nameKana` / `role` を更新できる<br>(b) `findById` が見つからないと `NotFoundException` |
| `findById` | (a) 取得成功<br>(b) `null` のとき `NotFoundException` |
| `restore` | (a) 削除済みユーザーを復元 → `enableUser` が呼ばれる<br>(b) 既に有効なら `BadRequestException`<br>(c) Cognito にユーザーが居ないと `BadGatewayException`<br>(d) その他失敗で `BadGatewayException` |
| `requestEmailChange` | (a) 同一 email で `BadRequestException`<br>(b) 他ユーザーが既に使用中で `ConflictException`<br>(c) Cognito の `AliasExistsException` で `ConflictException`<br>(d) `NotAuthorized` で `UnauthorizedException`<br>(e) その他 Cognito 失敗で `BadGatewayException` |
| `confirmEmailChange` | (a) 正常系: トランザクション内で email を更新し Verify が呼ばれる<br>(b) 保留中 email が現状と同じなら `BadRequestException`<br>(c) Verify が `CodeMismatch` で `BadRequestException` & DB ロールバック<br>(d) Verify が `ExpiredCode` で `BadRequestException` |
| `remove` | **既存維持**（順序検証・エラーハンドリング） |

### 4.2 `AuthService`

新規ファイル `src/auth/application/auth.service.spec.ts` を作成。

| メソッド | ケース |
| ---- | ---- |
| `login` | (a) `authenticated` 結果で `AUTHENTICATED` レスポンス<br>(b) `challenge` 結果（NEW_PASSWORD_REQUIRED）で `CHALLENGE` レスポンス<br>(c) `null` 戻りで `UnauthorizedException`<br>(d) 例外で `UnauthorizedException` |
| `completeNewPassword` | (a) 正常系: `AUTHENTICATED` レスポンス<br>(b) `null` 戻りで `UnauthorizedException`<br>(c) 例外で `UnauthorizedException` |
| `forgotPassword` | (a) 正常系: 例外なく完了<br>(b) `UserNotFound` は WARN ログのみで成功扱い<br>(c) その他失敗で `BadGatewayException` |
| `confirmForgotPassword` | (a) 正常系: 確定後に `globalSignOut` が呼ばれる<br>(b) `CodeMismatch` で `BadRequestException`<br>(c) `ExpiredCode` で `BadRequestException`<br>(d) `InvalidPassword` で `BadRequestException`<br>(e) `globalSignOut` 失敗は ERROR ログのみで成功扱い |
| `logout` | (a) 正常系<br>(b) Cognito 失敗で `BadGatewayException` |

---

## 5. 影響範囲

| 種別 | パス | 変更概要 |
| --- | --- | --- |
| backend (src) | `src/user/application/user.service.spec.ts` | テストケース追加（既存 `remove` テストは維持） |
| backend (src) | `src/auth/application/auth.service.spec.ts` | 新規 |
| docs | `docs/00_rules.md` | §8「テスト方針」を新設（本書 §3 を要約して反映） |
| docs | `docs/11_user-info_and_authentication.md` | §7 のテスト方針を §8 参照に更新 |
| docs | `docs/24_testing-strategy.md` | 本書（新規） |
| docs | `AGENTS.md` | ドキュメント表に本書を追記 |

migration / `.env.example` / フロントエンド / ランタイムコードの変更は **なし**（テストコードと docs のみ）。

---

## 6. リスク・未確定事項

- **トランザクション境界のテスト**: `confirmEmailChange` は `runInTransaction` を使う。モックでは「即時実行」として扱うため、ロールバックの実体は検証できない。本タスクでは「Verify 失敗時に txRepo の `save` が呼ばれた後に例外が伝播する」までを検証する。実 DB ロールバックの担保は将来の統合テストに委ねる。
- **既存 e2e**: `app.e2e-spec.ts` は `AppModule` 全体を起動するため Cognito JWKS フェッチや DB 接続が走る可能性がある。実際にローカルで通るかは Step 4（実装）で確認し、通らない場合はテストの取り扱い方針（skip / SKIP_AUTH 化）を別タスクとして切り出す。本タスクでは「現状緑なら維持、緑でないなら別タスク」とする。
- **Logger の出力**: テスト実行時に `Logger` の error / warn が標準出力に出る。テスト出力のノイズ低減はスコープ外（必要なら別タスクで `Logger` をモック差替する方針）。
