# Petal - AuthGuard の DB ユーザー存在・有効性チェック（テスト整備） 設計

対応タスク: **TSK-15「AuthGuard で DB ユーザーの存在・有効性チェック」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール（§8 テスト方針）
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) §5.5 — 認証ガードの仕様
- [docs/21_role-cognito-group-sync.md](21_role-cognito-group-sync.md) §3.2 — TSK-10 で AuthGuard に DB lookup を導入した経緯
- [docs/23_user-token-revocation-on-delete.md](23_user-token-revocation-on-delete.md) §3.2 — TSK-14 で「AuthGuard 側の挙動はテストで明示する」とした方針
- [docs/24_testing-strategy.md](24_testing-strategy.md) — TSK-28 で確定したテスト方針

---

## 1. 背景と本タスクの位置付け

TSK-15 の Notion 完了条件は次の 3 件：

1. softDelete 済みユーザーのトークンで API を叩くと 401 になる
2. DB に存在しない sub のトークンで 401
3. `request.user.role` などコントローラーが安全に参照できる

これら 3 件は **TSK-10（docs/21）で `JwtAuthGuard` に DB lookup を導入した時点ですべて実装済み**。現状コードは [backend/src/common/guards/jwt-auth.guard.ts:77-83](../backend/src/common/guards/jwt-auth.guard.ts#L77-L83) で

```ts
const user = await this.userRepository.findByCognitoSub(sub);
if (!user || user.deletedAt !== null) {
  throw new UnauthorizedException('認証ユーザーに対応するレコードがありません');
}
request.user = toAuthUser(user);
```

を実行しており、`AuthUser` 型に `role` を含む正規化済みオブジェクトをセットしている。

本タスクは **「実装済みの仕様をテストで明文化し、回帰を防ぐ」** ことに目的を絞る。Notion チケット本文で言及されていた **30 秒 in-memory キャッシュは本タスクでは入れない**（docs/21 §10 で「性能問題が見えてから判断」とした方針を踏襲）。

---

## 2. スコープと完了条件

### 対象

1. `backend/src/common/guards/jwt-auth.guard.spec.ts` を新規作成し、`JwtAuthGuard.canActivate` の振る舞いを網羅するユニットテストを追加する。
2. ドキュメント追加（本書）と `AGENTS.md` への追記。

### 非対象（別タスク化）

- **30 秒 in-memory キャッシュの実装**（[docs/21 §10](21_role-cognito-group-sync.md) と整合）。
- **`RolesGuard` のテスト**（TSK-15 の完了条件外。必要が生じた時点で別タスク）。
- **e2e でのトークン経由フロー検証**（実 Cognito JWT が必要になり SKIP_AUTH を切った状態のテストは現状不可）。
- **DB 実体を伴う統合テスト**（[docs/24 §1](24_testing-strategy.md) と整合）。

### 完了条件

- [ ] 削除済みユーザーのトークンで `canActivate` が `UnauthorizedException` を投げる。
- [ ] DB に存在しない sub のトークンで `canActivate` が `UnauthorizedException` を投げる。
- [ ] 有効ユーザーのトークンで `canActivate` が `true` を返し、`request.user` に `{ sub, userId, email, role }` がセットされる。
- [ ] `@Public()` デコレータがあるエンドポイントは認証なしで素通りする。
- [ ] `SKIP_AUTH=true` のとき DB のダミーユーザーを引いてセットする（`SKIP_AUTH_USER_ID` 指定 / 未指定の双方）。
- [ ] `SKIP_AUTH=true` のときダミーユーザーが見つからない / 削除済みなら 401。
- [ ] `Bearer` ヘッダー欠落 / JWT 検証失敗で 401。
- [ ] `pnpm --filter backend test` が緑（既存テスト含む）。
- [ ] `pnpm --filter backend build` が通る。

---

## 3. 設計（docs/24 のテスト方針に従う）

### 3.1 テスト配置

[docs/24 §3.3](24_testing-strategy.md) に従い、対象ファイル `jwt-auth.guard.ts` と同居する `jwt-auth.guard.spec.ts` に置く。

### 3.2 モック戦略

| 依存 | モック方針 |
| --- | --- |
| `ConfigService` | `useValue` でメソッド差替（`get` / `getOrThrow` を `jest.fn()` で実装） |
| `Reflector` | `useValue` で `getAllAndOverride` を `jest.fn()` 化 |
| `IUserRepository`（DI シンボル `USER_REPOSITORY`） | `useValue` で全メソッドを `jest.fn()` 化（[docs/24 §3.2](24_testing-strategy.md) 既定方針） |
| `CognitoJwtVerifier`（Guard コンストラクタで `create()` 生成） | コンストラクタ呼び出し後に **インスタンスの private プロパティ `verifier` を差し替え**。`as unknown as CognitoJwtVerifierSingleUserPool<VerifierProps>` で型ブリッジ。`as any` は使わない |
| `ExecutionContext` | `switchToHttp().getRequest()` がモック `Request` を返すスタブを `it` ごとに構築 |

`CognitoJwtVerifier.create` 自体は `aws-jwt-verify` ライブラリの内部処理で例外を出さないため、テスト用 `ConfigService` がダミー文字列を返せばコンストラクタは成功する。`verifier.verify` を後段で差し替えてふるまいを制御する。

### 3.3 テストケース一覧

| # | ケース | 期待 |
| --- | --- | --- |
| 1 | `@Public()` のとき | `true` を返す。`verifier.verify` も DB lookup も呼ばれない |
| 2 | `SKIP_AUTH=true` + `SKIP_AUTH_USER_ID` 指定で有効ユーザー | `true`。`request.user` がセットされる。`findById` が呼ばれる |
| 3 | `SKIP_AUTH=true` で `SKIP_AUTH_USER_ID` 未指定 | `findByCognitoSub('test-user')` が呼ばれる |
| 4 | `SKIP_AUTH=true` でダミーユーザーが見つからない | `UnauthorizedException` |
| 5 | `SKIP_AUTH=true` でダミーユーザーが `deletedAt !== null` | `UnauthorizedException` |
| 6 | `Authorization` ヘッダー欠落 | `UnauthorizedException`「認証トークンがありません」 |
| 7 | `Authorization` が `Bearer ` で始まらない | `UnauthorizedException`（同上） |
| 8 | `verifier.verify` が throw | `UnauthorizedException`「認証トークンが無効です」 |
| 9 | JWT 検証成功 + DB に該当 sub なし | `UnauthorizedException`「認証ユーザーに対応するレコードがありません」 |
| 10 | JWT 検証成功 + DB の該当ユーザーが `deletedAt !== null` | 同上 |
| 11 | JWT 検証成功 + 有効ユーザー | `true`。`request.user` に `{ sub, userId, email, role }` がセットされる |

### 3.4 テストヘルパー

- `buildContext(req)` ヘルパーで `ExecutionContext` をスタブ化。
- `buildUser(overrides)` は `UserService` の spec で確立した形を踏襲（domain `User` インスタンス）。
- 共通の `Reflector.getAllAndOverride` は `false` をデフォルト返却（`@Public()` 検出ケースのみ `true` に上書き）。

---

## 4. 影響範囲

| 種別 | パス | 変更概要 |
| --- | --- | --- |
| backend (test) | `src/common/guards/jwt-auth.guard.spec.ts` | 新規 |
| docs | `docs/25_authguard-db-validation-tests.md` | 本書（新規） |
| docs | `AGENTS.md` | ドキュメント表に本書を追記 |

ランタイムコード（`jwt-auth.guard.ts` 本体）の変更は **なし**。migration / `.env.example` / フロント変更も **なし**。

---

## 5. リスク・補足

- **Guard テストはスコープ外という TSK-28 方針との関係**: TSK-28（[docs/24 §1 非対象](24_testing-strategy.md)）では Cross-cutting / Guard テストを「別タスク」と切り出した。本書はその「別タスク」を TSK-15 の枠で実施するもの。docs/24 と整合する。
- **`verifier` プロパティ差替の妥当性**: NestJS の DI コンテナでは Guard が `Test.createTestingModule` で生成される。`verifier` は constructor 内のローカル生成のため DI 経由で差替できない。テスト固有の都合として private プロパティを `as unknown as ...` でブリッジする。プロダクションコードへの影響はない。
- **`Logger` 出力**: テスト実行時に Guard が直接 logger を呼ぶ箇所はない（既存実装のとおり）。出力ノイズはなし。
