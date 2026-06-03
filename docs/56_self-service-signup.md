# セルフサービスのサインアップ 設計（TSK-12）

## 0. 課題シート（Notion 転記）

> Notion タスク: [セルフサービスのサインアップ](https://app.notion.com/p/3589ca7d99dc8103ac39d9f21a070692)（TSK-12）

### 背景

[docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) §4.1 で v1.1 以降の課題として明記。現状はユーザー登録は管理者のみ可。

### 課題

- `POST /auth/signup` … Cognito の `SignUp` を呼ぶ。検証コードがメール送信される。
- `POST /auth/confirm-signup` … `ConfirmSignUp` でコード検証。確定後 DB に users 行を INSERT。
- フロント: サインアップ画面、コード入力画面を新設。ログイン画面に導線追加。
- Cognito User Pool で「セルフサインアップを有効」に設定変更。

### 完了条件（原文）

- 未認証ユーザーがメール検証付きで登録できる
- 登録完了後にログイン可能
- DB と Cognito にユーザーが整合した状態で存在する

### Phase 2 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 氏名・ふりがな（DB は NOT NULL） | サインアップ画面で入力し、**confirm 時にフロントから再送**して DB INSERT |
| 有効化フロー | **承認なし・即ログイン可**（role は常に `user`） |
| Cognito User Pool 設定変更 | **手順を docs に記載**・AWS コンソールの設定変更は別途（AI は AWS を操作しない） |
| スパム対策（reCAPTCHA 等） | 本タスク対象外（別タスク） |

---

## 1. 課題サマリ

未認証ユーザーが自分でアカウントを登録できるようにする。メールアドレス・パスワード・氏名・ふりがなを入力 → Cognito がメールに検証コードを送信 → コード確定で Cognito ユーザーが `CONFIRMED` になり、同時に DB の `users` テーブルへ `role = 'user'` のレコードを作成する。確定後は通常のログインで利用開始できる。

## 2. スコープ

### 対象

- backend: `POST /auth/signup` / `POST /auth/confirm-signup` の 2 エンドポイント
- backend: `CognitoAuthClient` に `signUp` / `confirmSignUp`、`CognitoUserClient` に `adminGetUserSub` を追加
- frontend: `/signup` ページ（フォーム → コード入力の 2 ステップ）、ログイン画面への導線
- docs: Cognito User Pool のセルフサインアップ有効化手順を [14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) / [38_cognito-dev-setup.md](38_cognito-dev-setup.md) に追記

### 対象外

- 管理者承認フロー（pending 状態）… 将来別タスク
- スパム対策（reCAPTCHA / レート制限）… 別タスク（TSK-17 と別観点）
- サインアップ時のロール選択（常に `user` 固定。`admin` は管理者作成のみ）
- AWS コンソールでの実際の設定変更操作

## 3. 制約

- DB `petal.users` は `name` / `name_kana` が NOT NULL（[11_user-info_and_authentication.md](11_user-info_and_authentication.md) §2.2）。
- Cognito の `SignUp` / `ConfirmSignUp` は **クライアントシークレットあり**のため `SECRET_HASH` が必須（既存 `computeSecretHash` を流用）。
- オニオン依存方向を維持（Application から AWS SDK を直接 import しない。Cognito 呼び出しは Infra のクライアントに閉じる）。
- 物理削除なし・`synchronize: false` 維持（[00_rules.md §4](00_rules.md)）。

## 4. 設計判断ログ

### 判断 1: 氏名・ふりがなの保持方法 → **confirm 時にフロントから再送**（採用）

- **採用**: signup は `email/password` で Cognito `SignUp`、confirm の body に `name/nameKana` を含めて送り、`ConfirmSignUp` 成功後に DB INSERT。
- **理由**: Cognito User Pool にカスタム属性（`custom:nameKana`）を追加する必要がなく、「Cognito 設定変更は別途」という Phase 2 方針と整合する。フロントは 2 ステップ間で氏名を state 保持するだけで済む。
- **却下**: Cognito 標準 `name` 属性 + `custom:nameKana` に保持して confirm 後 `AdminGetUser` で取得する案。サーバーが信頼できるソースから氏名を取れる利点はあるが、User Pool へのカスタム属性事前定義（手動設定）が増える。
- **改ざんリスク**: role は常に `user` 固定で氏名は表示用途のみのため、フロント保持による実害は軽微。

### 判断 2: DB INSERT のタイミング → **confirm 成功後のみ**（未確認ユーザーは DB に入れない）

- `SignUp` 時点では DB INSERT しない。`ConfirmSignUp` 成功後に `AdminGetUser` で `sub` を取得し DB INSERT する。
- **理由**: 未確認（メール検証前）のユーザーを DB に持つと、ログインできないゴミレコードや一覧汚染が生じる。確認済みのみ DB 化することで「DB に居る = 利用可能」を保てる。
- `sub` はフロントに返さず、confirm 時にサーバーが `AdminGetUser` で取得する（信頼できるソース）。

### 判断 3: confirm-signup の冪等性 → **再実行安全に設計**（採用）

- `ConfirmSignUp` が「既に確認済み（`Current status is CONFIRMED`）」で `NotAuthorizedException` を投げた場合は **成功扱い**で後続（DB INSERT）へ進む。
- DB INSERT 前に `findByCognitoSub(sub)` で既存チェックし、存在すれば INSERT をスキップ（冪等）。
- **理由**: 「`ConfirmSignUp` 成功 → DB INSERT 失敗」で中断した場合、ユーザーは Cognito 上 confirmed だが DB 行が無くログイン不可になる。エンドポイント全体を再実行可能にしておけば、再送信で復旧できる。

### 判断 4: トランザクション境界 → **DB トランザクション不要**（[00_rules.md §4](00_rules.md) の例外適用）

- confirm-signup の外部副作用は `ConfirmSignUp`（冪等・再試行安全）＋ DB は単一 INSERT のみ。複数 DB 書き込みを外部副作用と原子的に束ねる必要がない。
- §4 の例外「外部副作用がべき等で安全に再試行できる場合は本ルールを適用しなくてよい」に該当するため `runInTransaction` は使わない。冪等性（判断 3）で整合を担保する。

### 判断 5: 既存パターン踏襲

- backend は `forgotPassword` / `confirmForgotPassword`（Public エンドポイント + Zod safeParse + Cognito クライアント + 例外マッピング）を踏襲。
- frontend は `forgot-password` ページ（request → confirm の 2 ステップ + `PasswordPolicyChecklist`）を踏襲。

## 5. データモデル

DB スキーマ変更なし（migration 不要）。`petal.users` に既存カラムでそのまま INSERT する。

| カラム | 値 |
| ------ | -- |
| `id` | `randomUUID()` |
| `cognito_sub` | `AdminGetUser` で取得した `sub` |
| `email` | サインアップ時の email |
| `name` | confirm body の `name` |
| `name_kana` | confirm body の `nameKana` |
| `role` | `'user'`（固定） |
| `deleted_at` | `null` |

## 6. API 仕様

### 6.1 `POST /auth/signup`（`@Public`）

リクエスト:

```json
{ "email": "user@example.com", "password": "Passw0rd!", "name": "山田太郎", "nameKana": "やまだたろう" }
```

- Zod `SignupSchema`: `email`(email), `password`(min 8), `name`(min 1, max 100), `nameKana`(min 1, max 100)
- 処理: `cognitoAuth.signUp(email, password)` → `SignUpCommand`（`ClientId` / `SecretHash` / `Username=email` / `Password` / `UserAttributes:[{email}]`）。Cognito が検証コードをメール送信。
- レスポンス: `204 No Content`
- エラーマッピング:
  - `UsernameExistsException` → `409`「すでに登録済みのメールアドレスです」
  - `InvalidPasswordException` → `400`「パスワードがポリシーに合致していません」
  - `InvalidParameterException` → `400`「入力内容が正しくありません」
  - その他 → `502`「サインアップに失敗しました」

### 6.2 `POST /auth/confirm-signup`（`@Public`）

リクエスト:

```json
{ "email": "user@example.com", "code": "123456", "name": "山田太郎", "nameKana": "やまだたろう" }
```

- Zod `ConfirmSignupSchema`: `email`(email), `code`(min 1), `name`(min 1, max 100), `nameKana`(min 1, max 100)
- 処理:
  1. `cognitoAuth.confirmSignUp(email, code)` → `ConfirmSignUpCommand`
     - `CodeMismatchException` → `400`「コードが正しくありません」
     - `ExpiredCodeException` → `400`「コードの有効期限が切れています」
     - 「既に確認済み」(`NotAuthorizedException` /`CONFIRMED`/) → 成功扱いで続行（冪等）
     - `UserNotFoundException` → `400`「ユーザーが見つかりません」
  2. `cognitoUser.adminGetUserSub(email)` → `AdminGetUserCommand` で `sub` 取得
  3. `findByCognitoSub(sub)` が存在すれば終了（冪等）。無ければ `role='user'` で `users` へ INSERT
- レスポンス: `204 No Content`（トークンは返さない。確定後ユーザーは通常ログイン）

### 6.3 認可

両エンドポイントとも `@Public()`（未認証ユーザーが対象）。

## 7. シーケンス

```text
[フロント /signup フォーム]
  email/password/name/nameKana 入力
      → POST /auth/signup {email,password,name,nameKana}
[backend] CognitoAuthClient.signUp → Cognito SignUp（コードをメール送信）
      ← 204
[フロント] コード入力ステップへ（name/nameKana を state 保持）
  code 入力
      → POST /auth/confirm-signup {email,code,name,nameKana}
[backend]
  1. CognitoAuthClient.confirmSignUp(email,code)   ← Cognito ConfirmSignUp
  2. CognitoUserClient.adminGetUserSub(email)      ← Cognito AdminGetUser
  3. users へ INSERT（findByCognitoSub で冪等化）
      ← 204
[フロント] /login へ遷移（「登録が完了しました。ログインしてください」）
  → 通常ログイン → /images
```

## 8. トランザクション境界

判断 4 の通り DB トランザクションは使用しない。`ConfirmSignUp` の冪等性とエンドポイント全体の再実行安全性（判断 3）で DB と Cognito の整合を担保する。

## 9. 既存設計との差分

- 新規エンドポイント 2 本を追加するのみ。既存の login / logout / forgot-password 等への影響なし。
- Cognito User Pool 側で「セルフサインアップ有効化」「メール検証（Cognito 送信）」を ON にする必要がある（手順を docs に追記、設定変更は別途）。
- DB スキーマ・migration 変更なし。

## 10. 完了条件（具体化）

- [ ] `/login` に「アカウントを作成」導線がある
- [ ] `/signup` で email/password（ポリシー満たす）/氏名/ふりがなを入力 → 送信で検証コードがメール送信され、コード入力ステップに遷移する
- [ ] コード入力 → `POST /auth/confirm-signup` 成功で `petal.users` に `role='user'` の行が作成される
- [ ] confirm 後、その email/password で `/login` からログインでき `/images` に到達する
- [ ] DB の `cognito_sub` と Cognito の `sub` が一致（`findByCognitoSub` で引ける）
- [ ] 既存 email でのサインアップは `409` でメッセージ表示
- [ ] パスワードポリシー違反は送信ボタン無効化 or `400` でメッセージ表示
- [ ] `confirm-signup` を再実行しても安全（重複 INSERT・二重エラーにならない）
- [ ] `cd backend && pnpm build` / `cd frontend && pnpm build` が通る
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る

## 11. 手動動作確認シナリオ

1. ログアウト状態で `/login` を開き、「アカウントを作成」リンクから `/signup` に遷移する。
2. 新規 email・ポリシーを満たすパスワード・氏名・ふりがなを入力して送信 → コード入力画面になり、当該メールに検証コードが届く。
3. メールのコードを入力して送信 → 成功し `/login` に遷移（成功メッセージ表示）。
4. 同じ email/password でログイン → `/images` に到達する。
5. admin でログインし直しユーザー管理画面を見ると、当該ユーザーが `role=user` で表示される。
6. 既存 email（admin 作成済み等）で `/signup` を試す → `409`「すでに登録済みのメールアドレスです」。
7. ポリシー違反パスワードを入力 → チェックリストで弾かれ送信できない（or `400`）。
8. （冪等性）確定後にもう一度同じ code で confirm を送る → エラーにならず（既に確認済み扱い）。

## 12. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。

---

## 13. 実装計画（Phase 4）

### 13.1 変更・追加ファイル

#### backend

- `src/auth/infra/cognito-auth.client.ts`（変更）: `signUp(email,password)` / `confirmSignUp(email,code)`、`isUsernameExists` / `isInvalidParameter` / `isUserAlreadyConfirmed` ヘルパー追加（`SignUpCommand` / `ConfirmSignUpCommand` / `InvalidParameterException` を import）
- `src/user/infra/cognito-user.client.ts`（変更）: `adminGetUserSub(email)` 追加（`AdminGetUserCommand` を import）
- `src/user/application/user.service.ts`（変更）: `createSelfSignup({cognitoSub,email,name,nameKana})` 追加（`findByCognitoSub` で冪等・監査ログなし）
- `src/auth/application/auth.schemas.ts`（変更）: `SignupSchema` / `ConfirmSignupSchema` 追加
- `src/auth/controller/auth.dto.ts`（変更）: `SignupRequestDto` / `ConfirmSignupRequestDto` 追加
- `src/auth/application/auth.service.ts`（変更）: `UserService` を注入し `signup()` / `confirmSignup()` 追加
- `src/auth/controller/auth.controller.ts`（変更）: `POST /auth/signup` / `POST /auth/confirm-signup`（ともに `@Public`・204）
- `src/auth/application/auth.service.spec.ts`（変更）: `UserService` モックを追加（既存テスト維持）＋ signup/confirmSignup の新規テスト
- `src/user/application/user.service.spec.ts`（変更）: `createSelfSignup` のテスト追加
- `openapi.json`（再生成）

#### frontend

- `src/lib/api-hooks/use-auth-api.ts`（変更）: `signup` / `confirmSignup` 追加
- `src/app/signup/page.tsx`（新規）: form → confirm → done の 3 ステップ
- `src/app/signup/use-signup-page.ts`（新規）: 状態・ハンドラ（forgot-password 踏襲、`evaluatePasswordForm` 利用）
- `src/app/login/page.tsx`（変更）: 「アカウントを作成」導線を追加
- `src/lib/openapi/schema.d.ts`（再生成）

#### docs

- `docs/14_cognito-user-pool-setup.md` / `docs/38_cognito-dev-setup.md`（変更）: セルフサインアップ有効化・メール検証の設定手順を追記

migration / 環境変数 / 依存追加: **いずれも不要**（既存 `users` テーブル・既存 Cognito 変数で完結）。

### 13.2 作業順序（コミット単位）

1. **backend: Cognito クライアント拡張**（cognito-auth.client / cognito-user.client）— 完了確認 `cd backend && pnpm build`
2. **backend: UserService.createSelfSignup + テスト** — 完了確認 `cd backend && pnpm test && pnpm build`
3. **backend: signup/confirm-signup エンドポイント + spec 更新** — 完了確認 `cd backend && pnpm lint && pnpm test && pnpm build`
4. **backend: openapi.json 再生成**（`pnpm openapi:export`）— 完了確認 `/auth/signup` `/auth/confirm-signup` が openapi.json に出現
5. **frontend: auth API + /signup ページ + ログイン導線 + schema.d.ts 再生成** — 完了確認 `cd frontend && pnpm lint && pnpm build`
6. **docs: Cognito セルフサインアップ設定手順を追記** — 完了確認 `npx markdownlint-cli 'docs/**/*.md'`

### 13.3 テスト方針

- backend は Jest ユニットテスト（CI で `pnpm test`）。`AuthService.signup`（正常 / UsernameExists→409 / InvalidPassword→400 / その他→502）、`AuthService.confirmSignup`（正常 / CodeMismatch→400 / Expired→400 / 既確認は続行 / 冪等）、`UserService.createSelfSignup`（新規作成 / 既存は再利用）をカバー。
- frontend はユニットテスト無し（CI は lint/build のみ）。`pnpm build` で型・ビルドを担保。
- 完全な手動シナリオ（§11）は Cognito の「セルフサインアップ有効化」設定が前提のため、設定反映後に実機確認する（設定変更自体は別途）。

### 13.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 既存 forgot-password/login スタイルへの追従、エラーメッセージ文言、Zod 制約の微調整、design-system コンポーネントの選択。
- **中断して相談**:
  - Cognito の確認方式が「コード」でなく「リンク」だった等、API 想定差異
  - User Pool 設定の都合で `SignUp` が使えず `AdminCreateUser` 経由が必須になる場合
  - confirm 後に**自動ログイン（トークン発行）**へ方針変更したくなった場合（password 再保持が必要になり設計変更）
  - DB スキーマ・API 仕様・トランザクション境界の変更が必要になった場合

### 13.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | self-signup を監査ログに記録するか | **しない**。admin 操作ではなく、`AuditAction` への新規追加はスコープ外 |
| 2 | confirm 後にトークンを返すか | **返さない（204）**。confirm 時に password が無く再認証不可。ユーザーは `/login` で手動ログイン |
| 3 | signup のレスポンス | **204 No Content** |
| 4 | 「既に確認済み」の検出 | `isUserAlreadyConfirmed`= `NotAuthorizedException` かつ message に `CONFIRMED` を含む → 成功扱いで続行 |
| 5 | createSelfSignup の冪等チェック | `findByCognitoSub(sub)` のみ（email=Cognito username 一意のため sub 一意で十分） |
| 6 | password の Zod 制約 | `min(8)` のみ（ポリシー詳細はフロント `PasswordPolicyChecklist` で事前検証、最終判定は Cognito の `InvalidPasswordException`→400） |
| 7 | name/nameKana の Zod 制約 | `z.string().min(1).max(100)`（`user.schemas` の `CreateUserSchema` に合わせる） |
| 8 | confirm 成功後の画面遷移 | signup ページ内に **done ステップ**を表示（「登録が完了しました」+ `/login` ボタン）。`useSearchParams`/Suspense を避け login ページ改修を最小化 |
| 9 | ログイン導線の位置 | login フォーム下部、「パスワードを忘れた方」付近に「アカウントを作成」リンク |
| 10 | openapi 再生成 | backend `openapi.json` と frontend `schema.d.ts` を再生成しコミット（既存慣習） |
| 11 | DB INSERT の actor | self-signup のため actor 概念なし。`createSelfSignup` は actorId を取らない |
| 12 | auth.service.spec の既存テスト破壊 | `UserService` モックを `buildService` に追加して回避 |
