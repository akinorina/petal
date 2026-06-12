# 招待メールの再送 API 設計（TSK-25）

## 0. 課題シート（Notion 転記）

> Notion タスク: [招待メールの再送 API](https://app.notion.com/p/3589ca7d99dc818baa7ad8a1aa7af35a)（TSK-25）

### 背景

Cognito の招待メールに含まれる一時パスワードは 7 日で期限切れ。再送できないと、そのユーザーは管理者が一度削除して再作成しないとログインできない。

### 課題

- `POST /users/:id/resend-invite` を実装。Cognito の `AdminCreateUser` を `MessageAction=RESEND` で呼ぶ。
- 既にパスワードを変更済みのユーザーには無効（400 を返す）。
- 管理画面のユーザー一覧に「招待メール再送」ボタンを追加（FORCE_CHANGE_PASSWORD 状態のユーザーのみ表示）。

### 完了条件（原文）

- 招待メールが再送される
- パスワード変更済みユーザーには 400 を返す
- UI から再送できる

---

## 1. 課題サマリ

admin が「招待メール再送」ボタンを押すと `POST /users/:id/resend-invite` を呼び、`AdminGetUserCommand` で対象ユーザーが `UserStatus=FORCE_CHANGE_PASSWORD` であることを事前確認したうえで、`AdminCreateUserCommand` を `MessageAction=RESEND` で再投入する。パスワード変更済みなどで対象外のときは 400 を返す。

UI 側は、ユーザー一覧の各行に admin が利用できる「招待メール再送」アクションを追加する。`UserResponseDto` に `invitationPending: boolean` を新たに付加し、`true` のユーザーのみボタンを表示する。`invitationPending` は API 取得時に **対象ユーザー（softDelete 済みを除く）のみ** Cognito `AdminGetUser` を並列実行して算出する（数千件規模までを許容、上限は `limit ≤ 100` で抑え済み）。

## 2. スコープ

### 対象

- backend: `POST /users/:id/resend-invite`（admin 限定・204）
- backend: `UserService.resendInvite` + `CognitoUserClient.resendInvite` + `CognitoUserClient.adminGetUserStatus`
- backend: `findPage` レスポンスの `UserResponseDto` に `invitationPending: boolean` を付加
- backend: 監査ログに `RESEND_INVITE` を追加
- frontend: ユーザー一覧の各行に「招待メール再送」アクションを追加（`invitationPending === true` のみ表示）
- frontend: 再送成功時のトースト的フィードバック（既存 `Alert` を再利用）

### 対象外

- 一時パスワードを管理者が手動指定するフロー（Cognito の挙動に従い自動生成のみ）
- メール送信のテンプレート変更
- レート制限の追加実装（Cognito 側の標準制限に依存）
- パスワードリセットへの誘導 UI（既存のパスワードリセットを使えばよく、再送とは別フロー）

## 3. 制約

- 認可: `@Roles(UserRole.Admin)` を付与。
- 対象ユーザーは **アクティブ（softDelete されていない）** のみ。削除済みは 400。
- DB スキーマ変更・migration なし（状態は Cognito を正とする）。
- オニオン依存方向維持。Cognito 呼び出しは `infra` クライアントに閉じる。
- `findPage` での N+1 Cognito ルックアップは **アクティブタブ（`deleted=false`）でのみ** 行う。`deleted=true` タブでは全て `invitationPending=false` で返す（削除済みに再送は無いため）。

## 4. 設計判断ログ

### 判断 1: エンドポイント → **`POST /users/:id/resend-invite`（admin 限定・204）**（採用）

- 既存の `POST /users/:id/restore` と同じ形式で一貫性を保つ。
- レスポンス: `204 No Content`。
- 入力: なし（id はパスから）。

### 判断 2: Cognito 呼び出し順 → **AdminGetUser で状態確認 → MessageAction=RESEND**（採用）

- まず `AdminGetUserCommand` を呼び、`UserStatus` を取得して `FORCE_CHANGE_PASSWORD` であることを確認。`CONFIRMED` / `RESET_REQUIRED` などは 400。
- 状態が OK ならば `AdminCreateUserCommand` を `MessageAction=RESEND` で呼ぶ。RESEND はユーザーを新規作成せず既存ユーザーへ招待メールを再送するための公式モード。
- **理由**: Cognito の RESEND は `UserStatus=FORCE_CHANGE_PASSWORD` でないと `InvalidParameterException` を返すため、サーバ側で先に弾いて分かりやすい 400 メッセージを返す。

### 判断 3: 状態取得とリスト表示 → **`UserResponseDto.invitationPending` を付加し、`findPage` で一括判定**（採用）

- リストで「再送可能かどうか」を UI に出すため、`UserResponseDto` に `invitationPending: boolean` を追加。
- `findPage` の各行に対し `AdminGetUser` を `Promise.all` 並列実行（最大 100 件＝limit 上限）。
- **理由**: ListUsers + Filter で UserStatus を取れない（Cognito の ListUsers は Filter で UserStatus を直接絞れない実装のため）。一覧 1 ページの上限が 100 件と決まっているので、100 並列までは Cognito の通常運用で耐えられる。失敗したものは `invitationPending=false` 扱いとし、フロントには影響させない（警告ログのみ）。
- 削除済みタブでは Cognito 問い合わせをスキップ（判断 3 補足）。

### 判断 4: フロント UI → **行アクションに「招待メール再送」リンクを追加**（採用）

- 「編集」「削除」の並びに「招待メール再送」を追加。`invitationPending === true` のときのみ表示。
- 確認ダイアログを 1 段挟む（誤操作防止）。
- 成功時はトーストではなく、既存の `Alert` に短時間メッセージ表示（`use-users-page` に成功メッセージ用 state を追加）。

### 判断 5: 監査ログ → **`RESEND_INVITE` を新規追加**（採用）

- `AuditAction` に `RESEND_INVITE` を追加。
- メタデータ: `{ targetEmail }`。

### 判断 6: エラーマッピング（採用）

| 条件 | HTTP | メッセージ |
| --- | --- | --- |
| DB に存在しない / softDelete 済み | 404 | ユーザーが見つかりません |
| Cognito 上で存在しない | 502 | Cognito 上にユーザーが存在しません。整合性復旧が必要です |
| UserStatus が FORCE_CHANGE_PASSWORD 以外 | 400 | このユーザーは既にパスワード設定済みのため招待を再送できません |
| Cognito API 失敗（その他） | 502 | 招待メールの再送に失敗しました |

## 5. データモデル

DB 変更なし。Cognito の `UserStatus` を都度参照する。

## 6. API 仕様

### `POST /users/:id/resend-invite`（admin 限定）

リクエスト: bodyなし。

レスポンス: `204 No Content`

エラー: 判断 6 のマッピング。

### `GET /users`（既存・拡張）

- `UserResponseDto.invitationPending`（boolean）を追加。
- `deleted=false` のときのみ各行の Cognito 状態を並列取得（最大 100 件）。
- `deleted=true` のときは常に `false`。
- `GET /users/me`、`GET /users/:id` でも同じ計算（単件なので軽量）。

## 7. 既存設計との差分

- `AuditAction` に `RESEND_INVITE` 追加。
- `CognitoUserClient`:
  - `resendInvite(email)` 追加（`AdminCreateUserCommand` + `MessageAction='RESEND'`）。
  - `adminGetUserStatus(email)` 追加（`AdminGetUserCommand` の結果から `UserStatus` を返す。`UserNotFound` は `null` で返す）。
  - 例外判別: `isInvalidParameter(err)` を追加（Cognito 側で状態不整合のとき）。
- `UserService`:
  - `resendInvite(id, actorId)` 追加。
  - `findPage` / `findById` の戻り値に `invitationPending` を含めるため、内部で `enrichWithInvitationStatus` を呼ぶ補助メソッドを追加。
- `UserController`:
  - `POST /users/:id/resend-invite` 追加。
  - 既存の `findAll` / `findById` / `findMe` / `create` 等のレスポンスに `invitationPending` が含まれるよう `toResponse` を拡張。
- `UserResponseDto`: `invitationPending: boolean` を追加。
- frontend:
  - 一覧の各行アクションに「招待メール再送」（`invitationPending` 時のみ）を追加。
  - 確認ダイアログ + `useUsersApi.resendInvite(id)` を追加。
  - 成功メッセージ用 state を `use-users-page` に追加。
- `openapi.json` / `schema.d.ts` 再生成。

## 8. トランザクション境界

なし。

- `AdminGetUser` で事前チェック → `AdminCreateUser(RESEND)`。両方 Cognito 上の操作で、副作用は再送のみ。DB 書き込みなし。
- 監査ログは「呼び出し成功後」に best-effort で記録。

## 9. 完了条件（具体化）

- [ ] admin で `POST /users/:id/resend-invite` を叩くと招待メールが再送され `204`
- [ ] 対象が FORCE_CHANGE_PASSWORD でないとき `400`「このユーザーは既にパスワード設定済み...」
- [ ] 対象が DB に存在しない / softDelete 済みのとき `404`
- [ ] 対象が Cognito にいないとき `502`
- [ ] admin 以外で叩くと `403`
- [ ] 一覧で `invitationPending === true` のユーザーにのみ「招待メール再送」リンクが表示される
- [ ] 再送成功時に Alert で成功メッセージが表示される
- [ ] 監査ログ `RESEND_INVITE` が記録される
- [ ] `user.service.spec.ts` に主要パスのテストを追加
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` / `cd frontend && pnpm lint && pnpm build` が通る

## 10. 手動動作確認シナリオ

1. admin で新規ユーザーを作成（一時パスワード状態）。一覧で当該行に「招待メール再送」リンクが出る。
2. リンクをクリック → 確認ダイアログ → 「再送する」 → 成功メッセージが Alert に出る。新ユーザーの受信箱に再送メールが届く。
3. 新ユーザーが初回ログインしてパスワードを設定したあと、一覧をリロード → 当該行から「招待メール再送」が消える。
4. その状態で `POST /users/:id/resend-invite` を curl で叩く → `400`「このユーザーは既にパスワード設定済み...」。
5. 一般ユーザーで `POST /users/:id/resend-invite` を叩く → `403`。
6. 削除済みタブで「招待メール再送」リンクが表示されないこと。
7. 監査ログ画面で `RESEND_INVITE` が記録されていることを確認。

## 11. 未確定事項

- なし（Phase 2/3 で確定済み）。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### backend

- `src/user/infra/cognito-user.client.ts`（変更）:
  - `resendInvite(email)` 追加（`AdminCreateUserCommand` + `MessageAction='RESEND'`）
  - `adminGetUserStatus(email)` 追加（戻り値: `string | null`、`UserNotFound` は `null`）
  - `isInvalidParameter(err)` 追加（`InvalidParameterException` 判定）
- `src/user/application/user.service.ts`（変更）:
  - `resendInvite(id, actorId)` 追加（softDelete チェック→Cognito 状態確認→RESEND→監査ログ）
  - `findPage` / `findById` / `findByCognitoSub` の戻り値に invitationPending を含めるため、内部で `enrichInvitationStatus` を呼ぶ
  - **理由**: ドメイン `User` を変えるのではなく、Application 層で `UserWithStatus = User & { invitationPending: boolean }` を返すサービス用型を新設
- `src/user/application/user.types.ts`（新規）: `UserWithStatus` 型定義
- `src/audit/domain/audit-action.enum.ts`（変更）: `RESEND_INVITE` を追加
- `src/user/controller/user.controller.ts`（変更）:
  - `POST /users/:id/resend-invite` を追加（admin 限定・204）
  - `toResponse` を `(UserWithStatus) => UserResponseDto` に変更（`invitationPending` を載せる）
- `src/user/controller/user.dto.ts`（変更）: `UserResponseDto.invitationPending: boolean`
- `src/user/application/user.service.spec.ts`（変更）: `resendInvite` テスト、`findPage` の invitationPending テスト
- `openapi.json`（再生成）

#### frontend

- `src/lib/api.ts`（変更）: `userApi.resendInvite(id)` 追加
- `src/lib/api-hooks/use-users-api.ts`（変更）: `resendInvite(id)` 追加
- `src/app/(authenticated)/users/use-users-page.ts`（変更）: `handleResendInvite` + 成功メッセージ state + `modal.type === 'resend-invite'` 追加
- `src/app/(authenticated)/users/page.tsx`（変更）: 行アクションに「招待メール再送」（`invitationPending` 時のみ）+ 確認ダイアログ + 成功メッセージ表示
- `src/lib/openapi/schema.d.ts`（再生成）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **backend: 監査ログ enum + Cognito クライアント拡張 + UserService.resendInvite + UserResponseDto に invitationPending + テスト + openapi 再生成** — 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build` 通過、`openapi.json` の更新確認
2. **frontend: userApi.resendInvite + use-users-api / use-users-page / page.tsx に再送 UI + schema 再生成** — 完了確認: `cd frontend && pnpm lint && pnpm build` 通過

### 12.3 テスト方針

- `user.service.spec.ts`:
  - `resendInvite` 正常系: AdminGetUser → resendInvite → 監査ログ呼出を確認
  - 状態が FORCE_CHANGE_PASSWORD 以外で `BadRequestException`
  - Cognito で存在しないとき `BadGatewayException`
  - softDelete 済みで `NotFoundException`
  - `findPage` の `invitationPending` が `adminGetUserStatus` の結果で正しく付与される
- frontend: 手動シナリオ（§10）で担保。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: ボタン文言、Alert メッセージ、確認ダイアログ文言。
- **中断して相談**: 一覧の `invitationPending` を毎回 Cognito 引きすることが性能上問題と判明した場合（DB に `firstLoginAt` を持つ案など）。

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | エンドポイント | `POST /users/:id/resend-invite`（admin・204） |
| 2 | Cognito 呼び出し | `AdminGetUser` → `AdminCreateUser(MessageAction=RESEND)` |
| 3 | 状態判定 | `UserStatus === 'FORCE_CHANGE_PASSWORD'` |
| 4 | 並列 Cognito 引き | 一覧（最大 100 件）で `Promise.all`、失敗は warn ログ + `false` |
| 5 | 削除済みタブ | 常に `invitationPending=false`（Cognito 引きスキップ） |
| 6 | UI | 行アクションに「招待メール再送」（条件付き表示）+ 確認ダイアログ + Alert で成功メッセージ |
| 7 | 監査ログ | `RESEND_INVITE`、metadata: `{ targetEmail }` |
| 8 | エラーマッピング | 状態不一致→400 / 不在→404 or 502 / その他→502 |
