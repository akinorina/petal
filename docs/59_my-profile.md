# 自分のプロフィール変更 API 設計（TSK-21）

## 0. 課題シート（Notion 転記）

> Notion タスク: [自分のプロフィール変更 API](https://app.notion.com/p/3589ca7d99dc815ba918c92791ad8153)（TSK-21）

### 背景

現状 `PATCH /users/:id` は admin 用想定。一般ユーザーが自分の氏名・ふりがなを変更する手段がない。

### 課題

- `PATCH /users/me` を実装。認証済みユーザーが自身の `name` / `nameKana` を変更できる。
- `role` / `email` / `cognitoSub` は対象外（別タスク）。
- フロントに「マイページ」を追加し、編集フォームを置く。

### 完了条件（原文）

- `GET /users/me` で自身のプロフィールを取得できる
- `PATCH /users/me` で name / nameKana を更新できる
- role / email を変更しようとしても無視される

### Phase 2 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 監査ログ | **記録しない**。専用 `updateMyProfile()` を追加（admin 操作の `update()` は再利用しない） |
| role / email の無視 | Zod スキーマを **name / nameKana に限定**し、それ以外の入力は捨てる |
| フロント構成 | **中央 `/me` ページを新設して集約**。ヘッダーの email リンクを `/me` に変更し、そこから「メール変更 / 2 段階認証」へ |
| `GET /users/me` | **既に実装済み**（プロフィール + mfaEnabled を返す）。本タスクでは追加実装不要 |

---

## 1. 課題サマリ

認証済みユーザーが自身の氏名・ふりがなのみを変更できる `PATCH /users/me` を追加する。`role` / `email` / `cognitoSub` は対象外（スキーマで弾く）。フロントは中央のマイページ `/me` を新設し、プロフィール表示と氏名・ふりがな編集フォームを置く。`GET /users/me` は既存を利用する。

## 2. スコープ

### 対象

- backend: `PATCH /users/me`（認証済みユーザーが自身の name / nameKana を更新）
- backend: `UserService.updateMyProfile`（audit なし・role/email を触らない）
- frontend: `/me` マイページ（表示 + 編集）、ヘッダー導線を `/me` に集約
- frontend: `userApi.updateMyProfile` と openapi 型再生成

### 対象外

- `role` / `email` / `cognitoSub` の変更（email は別途 `/me/email`、role は admin の `PATCH /users/:id`）
- `GET /users/me` の新規実装（既存）
- 監査ログ記録

## 3. 制約

- 認可: グローバル `JwtAuthGuard` 配下。`@Roles` は付けず**任意の認証ユーザー**が対象だが、操作対象は常に `request.user.userId`（自分自身）に限定する。
- ルーティング: `@Patch('me')` を `@Patch(':id')`（admin 用）より**前に宣言**して衝突を防ぐ。
- 物理削除なし・`synchronize: false` 維持。DB スキーマ変更なし。

## 4. 設計判断ログ

### 判断 1: 専用 `updateMyProfile()` を追加（採用）

- admin 用 `update()` は role 変更チェックと `AuditAction.UpdateUser` 記録を含む。自分のプロフィール変更でこれを再利用すると actor=target の監査ログが量産される。
- 自分の name / nameKana 変更だけを行う `updateMyProfile(userId, { name?, nameKana? })` を追加し、**監査ログを記録しない**。

### 判断 2: role / email の無視 → **Zod スキーマで限定**（採用）

- `UpdateMyProfileSchema = { name?, nameKana? }`。`role` / `email` を body に入れても Zod の出力に含まれず無視される。
- これにより「role / email を変更しようとしても無視される」完了条件を満たす。

### 判断 3: ルート順 → **`@Patch('me')` を先に宣言**（採用）

- 既存の `@Get('me')` と同様、`:id` パラメータ route より前に置くことで `me` が id として解釈されるのを防ぐ。

### 判断 4: フロント → **中央 `/me` ページに集約**（採用）

- これまで存在しなかった `/me`（プロフィール）ページを新設し、ヘッダーの email リンク（現状 `/me/email` 直行）を `/me` に変更。`/me` から「メール変更」「2 段階認証」へ遷移する導線にする。

## 5. データモデル

DB スキーマ変更なし（既存 `petal.users` の name / name_kana を更新）。migration 不要。

## 6. API 仕様

### `PATCH /users/me`

リクエスト:

```json
{ "name": "山田太郎", "nameKana": "やまだたろう" }
```

- Zod `UpdateMyProfileSchema`: `name`(min 1, max 100, optional) / `nameKana`(min 1, max 100, optional)
- 認可: 認証済みユーザー（`@Roles` なし）。対象は `request.user.userId`（自分）
- 処理: `userService.updateMyProfile(actor.userId, { name?, nameKana? })`
- レスポンス: `200` + `UserResponseDto`（更新後のプロフィール）
- `role` / `email` / `cognitoSub` を含めても無視（スキーマで除外）

### `GET /users/me`（既存・変更なし）

- 自身のプロフィール + `mfaEnabled` を返す。

## 7. 既存設計との差分

- `UserController` に `@Patch('me')` を 1 本追加（`/me` 系の上部、`:id` より前）。
- `UserService.updateMyProfile` を追加。admin 用 `update()` は変更しない。
- frontend: `/me/page.tsx`・`use-me-page.ts` 新設、`userApi.updateMyProfile` 追加、ヘッダー導線変更、`/me`⇄`/me/email`⇄`/me/mfa` の相互リンク整備、`schema.d.ts` 再生成。
- DB・migration 変更なし。

## 8. トランザクション境界

なし（単一行 UPDATE のみ・外部副作用なし）。

## 9. 完了条件（具体化）

- [ ] `GET /users/me` で自身のプロフィールを取得できる（既存・回帰）
- [ ] `PATCH /users/me` で name / nameKana を更新でき、更新後のプロフィールが返る
- [ ] body に role / email を入れても無視される（DB の role / email は不変）
- [ ] フロント `/me` でプロフィール表示と氏名・ふりがな編集ができ、保存後に反映される
- [ ] ヘッダーの導線が `/me` 集約になり、`/me`⇄`/me/email`⇄`/me/mfa` を行き来できる
- [ ] `UserService.updateMyProfile` の単体テストがある
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` / `cd frontend && pnpm lint && pnpm build` が通る

## 10. 手動動作確認シナリオ

1. ログインしヘッダーの email リンクをクリック → `/me`（マイページ）に遷移し、email / 氏名 / ふりがなが表示される。
2. 氏名・ふりがなを編集して保存 → 成功表示。再読込しても変更が反映されている。
3. `/me` から「メールアドレス変更」「2 段階認証」へ遷移できる。各ページから `/me` に戻れる。
4. （API 直接）`PATCH /users/me` に `role: "admin"` や `email` を含めて送る → 200 だが role / email は変わらない。
5. ユーザー管理画面（admin）で当該ユーザーの氏名が更新されている。

## 11. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### backend

- `src/user/application/user.schemas.ts`（変更）: `UpdateMyProfileSchema` + 型
- `src/user/controller/user.dto.ts`（変更）: `UpdateMyProfileRequestDto`（name? / nameKana?）
- `src/user/application/user.service.ts`（変更）: `updateMyProfile(userId, input)`（audit なし）
- `src/user/controller/user.controller.ts`（変更）: `@Patch('me')` を `/me` 群に追加（`:id` より前）
- `src/user/application/user.service.spec.ts`（変更）: `updateMyProfile` のテスト
- `openapi.json`（再生成）

#### frontend

- `src/lib/api.ts`（変更）: `userApi.updateMyProfile(body)`
- `src/app/(admin)/me/page.tsx`（新規）: プロフィール表示 + 氏名/ふりがな編集
- `src/app/(admin)/me/use-me-page.ts`（新規）: `userApi.findMe` で読込・`updateMyProfile` で保存
- `src/app/(admin)/me/email/page.tsx` / `me/mfa/page.tsx`（変更）: nav に「プロフィール」(/me) を追加
- `src/app/(admin)/layout.tsx`（変更）: ヘッダー email リンクを `/me/email` → `/me`
- `src/lib/openapi/schema.d.ts`（再生成）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **backend: PATCH /users/me + updateMyProfile + テスト + openapi 再生成** — 完了確認 `cd backend && pnpm lint && pnpm test && pnpm build`、`/users/me` の patch が openapi.json に出る
2. **frontend: /me ページ + api + 導線 + schema 再生成** — 完了確認 `cd frontend && pnpm lint && pnpm build`

### 12.3 テスト方針

- `user.service.spec.ts`: `updateMyProfile` が name/nameKana を更新し、未指定項目は不変、audit を呼ばない（`auditLogService.record` 未呼出）ことを確認。
- frontend はユニットテスト無し（lint/build で担保）。手動シナリオ（§10）で確認。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 画面文言・フォーム配置、nav リンク文言。
- **中断して相談**: API 仕様/スキーマ変更が必要、role/email を扱う必要が出た、AuthContext に name を持たせる必要が出た場合。

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | 空 body | name/nameKana 両方 undefined → 変更なしで現在値を返す |
| 2 | レスポンス | `200` + `UserResponseDto`（`toResponse`、mfaEnabled は付けない） |
| 3 | ルート順 | `@Patch('me')` を `/me` 群（`:id` より前）に置く |
| 4 | 認可 | `@Roles` なし・対象は常に `request.user.userId`（自分） |
| 5 | フロント読込 | `userApi.findMe()` で name/nameKana/email を取得 |
| 6 | 保存後 | 返却値でフォーム更新 + 成功表示。AuthContext は更新不要（name を持たない） |
| 7 | 導線 | `/me`⇄`/me/email`⇄`/me/mfa` を nav 相互リンク、ヘッダーは `/me` へ |
| 8 | audit | `updateMyProfile` では `auditLogService.record` を呼ばない |
