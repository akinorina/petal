# セルフユーザー登録可否を環境変数で設定 設計（TSK-103）

## 0. 課題シート（Notion 転記）

> Notion タスク: [セルフユーザー登録可否を環境変数で設定](https://app.notion.com/p/3749ca7d99dc80b6aa46fef8da4e1add)（TSK-103）

### 一行サマリ

セルフユーザー登録の可否を環境変数で切り替えられるようにする。

### 背景・動機

[docs/56_self-service-signup.md](56_self-service-signup.md)（TSK-12）でセルフサインアップを実装した。これを手軽に ON/OFF 切り替えられるようにしたい。

### 完了条件（原文）

- ON のとき、セルフでユーザー登録が可能であること。
- OFF のとき、セルフでユーザー登録が不可能であること。（デフォルト）

### Phase 2 / 3 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 制御範囲 | **バックエンド + フロントエンド両方** |
| 可否フラグの真実のソース | **backend の env `SELF_SIGNUP_ENABLED` 単一**。`true` のときのみ有効・デフォルト OFF |
| フロントへの伝達 | **公開エンドポイント `GET /auth/signup-config` → `{ enabled }`**（ビルド時埋め込みの `NEXT_PUBLIC_*` は使わない。再ビルド不要で切替を即反映） |
| OFF 時の API 拒否 | `POST /auth/signup` / `POST /auth/confirm-signup` を **403 Forbidden**「現在ユーザー登録は受け付けていません」 |
| OFF 時のフロント | `/login` の「アカウントを作成」導線を非表示。`/signup` はフォームを出さずメッセージ表示 |
| スコープ外 | 管理者による招待・ユーザー作成（影響なし）／スパム対策 |

---

## 1. 課題サマリ

TSK-12 のセルフサインアップ機能に「環境変数による可否切替」を載せる。backend の単一 env `SELF_SIGNUP_ENABLED`（`true` のみ有効・未設定/その他は OFF）を真実のソースとし、(1) backend の `signup` / `confirm-signup` を OFF 時に 403 で塞ぎ、(2) 公開エンドポイント `GET /auth/signup-config` で現在値をフロントへ伝達して `/login` の導線と `/signup` ページを出し分ける。

## 2. スコープ

### 対象

- backend: `SELF_SIGNUP_ENABLED` を `AuthService` で読み取り、`signup` / `confirmSignup` の先頭でガード（OFF → 403）
- backend: 公開エンドポイント `GET /auth/signup-config`（`@Public`・`{ enabled: boolean }`）を新設
- frontend: `/login` の「アカウントを作成」導線を `enabled` のときのみ表示
- frontend: `/signup` を表示時に config 取得し、無効ならフォームを出さずメッセージ表示
- backend `.env.example` に `SELF_SIGNUP_ENABLED` を追記
- openapi.json / schema.d.ts 再生成

### 対象外

- 管理者による招待・ユーザー作成（`AdminCreateUser` 経由。本フラグの影響を受けない）
- スパム対策（reCAPTCHA / レート制限）
- Cognito User Pool 側のセルフサインアップ設定変更（AWS コンソール作業）
- 可否の DB 化・管理画面からの動的切替（env で十分なため対象外）

## 3. 制約

- クライアントシークレット等の秘密情報を `NEXT_PUBLIC_*` に置かない（[00_rules.md §5](00_rules.md)）。本フラグは公開して問題ない真偽値だが、ビルド時埋め込みを避けるため公開 API 経由とする。
- オニオン依存方向を維持。env 読み取りは `ConfigService` 経由（既存 `LOGIN_LOCKOUT_*` と同じく `AuthService` コンストラクタで取得）。
- DB スキーマ変更なし・migration 不要。
- 既存のセルフサインアップ実装（TSK-12）の振る舞いは ON 時に従来通り維持する。

## 4. 設計判断ログ

### 判断 1: 真実のソース → **backend env 単一 + 公開 API**（採用）

- **採用**: env は backend の `SELF_SIGNUP_ENABLED` のみ。フロントは `GET /auth/signup-config` で取得。
- **理由**: 単一ソースで backend ガードとフロント表示が必ず一致する。env 変更のみで切替が反映され、フロント再ビルド不要（「手軽に切り替えたい」という動機に合致）。
- **却下**: frontend にも `NEXT_PUBLIC_SELF_SIGNUP_ENABLED` を持つ案。`NEXT_PUBLIC_*` はビルド時に固定値が埋め込まれる（[frontend/src/lib/api-base-url.ts](../frontend/src/lib/api-base-url.ts) のコメント）ため、切替に再ビルド・再デプロイが必要で、backend 値との不整合リスクもある。

### 判断 2: env の解釈 → **`'true'` のときのみ有効・デフォルト OFF**（採用）

- `config.get<string>('SELF_SIGNUP_ENABLED') === 'true'` で真偽化。未設定・空・`'false'`・その他文字列はすべて OFF。
- **理由**: 完了条件で「デフォルト OFF」が明示されている。フェイルセーフ（設定漏れ時は登録不可）に倒す。

### 判断 3: backend ガードの実装箇所 → **`AuthService.signup` / `confirmSignup` の先頭**（採用）

- 両メソッドの先頭で `if (!this.selfSignupEnabled) throw new ForbiddenException('現在ユーザー登録は受け付けていません')`。
- **理由**: Controller は薄く保ち、ビジネス判断（可否）は Application 層に置く既存方針に沿う。signup だけでなく confirm-signup も塞ぐことで、OFF 切替の瞬間に signup 済みだったユーザーの確定も含めて一律に止める。
- **却下**: 専用 Guard / デコレータ案。1 フラグ・2 メソッドのために横断ガードを足すのは過剰。

### 判断 4: OFF 時のステータス → **403 Forbidden**（採用）

- 「機能は存在するが現在は受け付けていない」を明示。フロントは 403 を握ってメッセージ表示する（通常はフロント側で事前に導線を消すため、403 は直 POST 等のフォールバック）。

### 判断 5: config 取得エンドポイント → **`GET /auth/signup-config`**（採用）

- `@Public`・`200`・`{ enabled: boolean }`。`AuthService.getSignupConfig()` が `{ enabled: this.selfSignupEnabled }` を返すだけ。
- **理由**: auth フィーチャ内に閉じる。将来サインアップ以外の公開フラグが増えたら汎用 `GET /config` への一般化を検討するが、現時点では YAGNI。

### 判断 6: 既存パターン踏襲

- env 読み取りは `AuthService` コンストラクタで `ConfigService` から取得し private フィールド保持（既存 `LOGIN_LOCKOUT_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_DURATION_MINUTES` と同形）。
- フロントの API 呼び出しは `frontend/src/lib/api-hooks/use-auth-api.ts` に関数追加（既存 `signup` / `confirmSignup` と同じ場所）。

## 5. データモデル

DB スキーマ変更なし（migration 不要）。

## 6. API 仕様

### 6.1 `GET /auth/signup-config`（`@Public`・新規）

- リクエスト: なし
- レスポンス: `200 OK` `{ "enabled": true | false }`
- 処理: `AuthService.getSignupConfig()` が `{ enabled: this.selfSignupEnabled }` を返す。

### 6.2 `POST /auth/signup`（`@Public`・既存にガード追加）

- 先頭で `selfSignupEnabled` が false なら `403 Forbidden`「現在ユーザー登録は受け付けていません」。
- ON 時は従来通り（[docs/56](56_self-service-signup.md) §6.1）。

### 6.3 `POST /auth/confirm-signup`（`@Public`・既存にガード追加）

- 先頭で `selfSignupEnabled` が false なら `403 Forbidden`「現在ユーザー登録は受け付けていません」。
- ON 時は従来通り（[docs/56](56_self-service-signup.md) §6.2）。

## 7. フロントエンド挙動

### 7.1 `/login`

- マウント時に `GET /auth/signup-config` を取得。`enabled === true` のときのみ「アカウントを作成」リンクを表示する。取得前・取得失敗時はリンク非表示（フェイルセーフ）。

### 7.2 `/signup`

- マウント時に `GET /auth/signup-config` を取得。
  - 取得中: ローディング表示（既存の簡素な表現に合わせる）。
  - `enabled === false`（または取得失敗）: フォームを出さず「現在ユーザー登録は受け付けていません」メッセージ + 「ログイン画面へ戻る」リンクのみ表示。
  - `enabled === true`: 従来の form → confirm → done フロー。

## 8. トランザクション境界

DB 書き込みを追加しないため対象外（env 読み取りとガードのみ）。

## 9. 既存設計との差分

- 既存 `signup` / `confirmSignup` の先頭にガードを 1 つ追加するのみ（ON 時の振る舞いは不変）。
- 公開エンドポイント `GET /auth/signup-config` を 1 本追加。
- フロント `/login` `/signup` に config 取得と出し分けを追加。
- DB・migration 変更なし。

## 10. 完了条件（具体化）

- [ ] `SELF_SIGNUP_ENABLED=true` のとき、`/signup` から従来通りセルフ登録できる（[docs/56](56_self-service-signup.md) のフロー）。
- [ ] `SELF_SIGNUP_ENABLED` 未設定 or `true` 以外のとき:
  - [ ] `POST /auth/signup` が `403`「現在ユーザー登録は受け付けていません」。
  - [ ] `POST /auth/confirm-signup` が `403`「現在ユーザー登録は受け付けていません」。
  - [ ] `/login` に「アカウントを作成」導線が表示されない。
  - [ ] `/signup` にアクセスするとフォームが出ず、登録停止メッセージ + ログイン導線のみ表示される。
- [ ] `GET /auth/signup-config` が現在の env に応じた `{ enabled }` を返す。
- [ ] `backend/.env.example` に `SELF_SIGNUP_ENABLED` が追記されている。
- [ ] `AuthService.signup` / `confirmSignup` / `getSignupConfig` のユニットテストが緑。
- [ ] `cd backend && pnpm build` / `cd frontend && pnpm build` が通る。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 11. 手動動作確認シナリオ

OFF（デフォルト）の確認:

1. `backend/.env` から `SELF_SIGNUP_ENABLED` を外す（または `false`）。backend 起動。
2. `/login` を開く → 「アカウントを作成」リンクが**無い**。
3. `/signup` に直接アクセス → フォームが出ず「現在ユーザー登録は受け付けていません」+「ログイン画面へ戻る」のみ表示。
4. `curl -X POST .../auth/signup` を直接叩く → `403`「現在ユーザー登録は受け付けていません」。

ON の確認:

1. `backend/.env` に `SELF_SIGNUP_ENABLED=true` を設定し backend 再起動。
2. `/login` に「アカウントを作成」リンクが**表示される**。
3. `/signup` から email/氏名/ふりがな/パスワードを入力 → 確認コード → 登録完了 → `/login` でログインできる（[docs/56](56_self-service-signup.md) §11 と同等）。

## 12. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定）。

---

## 13. 実装計画（Phase 4）

### 13.1 変更・追加ファイル

#### backend

- `src/auth/application/auth.service.ts`（変更）: コンストラクタで `this.selfSignupEnabled = config.get<string>('SELF_SIGNUP_ENABLED') === 'true'` を保持。`signup` / `confirmSignup` 先頭に OFF → `ForbiddenException('現在ユーザー登録は受け付けていません')` を追加。`getSignupConfig(): SignupConfigResponseDto` を追加（`{ enabled: this.selfSignupEnabled }`）。`ForbiddenException` を import。
- `src/auth/controller/auth.dto.ts`（変更）: `SignupConfigResponseDto { enabled!: boolean }` を追加。
- `src/auth/controller/auth.controller.ts`（変更）: `GET /auth/signup-config`（`@Public` / `@HttpCode(200)` / `@ApiOkResponse({ type: SignupConfigResponseDto })`）を追加し `authService.getSignupConfig()` を返す。
- `src/auth/application/auth.service.spec.ts`（変更）: 既定 `configValues` に `SELF_SIGNUP_ENABLED: 'true'` を追加（既存 signup/confirmSignup テスト維持）。`buildMockConfig(overrides?)` / `buildService(..., configOverrides?)` を拡張。OFF 時に `signup`/`confirmSignup` が `ForbiddenException`、`getSignupConfig` が `{enabled}` を返す新規テストを追加。
- `backend/openapi.json`（再生成）。
- `backend/.envs/.env.local.example` / `.env.dev.example`（変更）: `Auth` セクションに `SELF_SIGNUP_ENABLED`（既定コメント付き、`true` で有効）を追記。

#### frontend

- `src/lib/api-hooks/use-auth-api.ts`（変更）: `getSignupConfig(): Promise<{ enabled: boolean }>` を追加（`GET /auth/signup-config`）。`useAuthApi` の返却に含める。
- `src/app/login/use-login-page.ts`（変更）: `useAuthApi` の `getSignupConfig` をマウント時に呼び `signupEnabled`（既定 false・失敗時も false）を公開。
- `src/app/login/page.tsx`（変更）: 「アカウントを作成」ブロックを `signupEnabled` のときのみ表示。
- `src/app/signup/use-signup-page.ts`（変更）: マウント時に config 取得し `configStatus: 'loading' | 'enabled' | 'disabled'` を公開（失敗時 disabled）。
- `src/app/signup/page.tsx`（変更）: `loading` はローディング表示、`disabled` は「現在ユーザー登録は受け付けていません」+「ログイン画面へ戻る」、`enabled` は従来フロー。
- `src/lib/openapi/schema.d.ts`（再生成）。

migration / 依存追加: **不要**。環境変数: `SELF_SIGNUP_ENABLED` を追加（example のみ。`.env` 実体はコミットしない）。

### 13.2 作業順序（コミット単位）

1. **backend: 可否フラグ + ガード + signup-config + DTO + テスト + env example** — 完了確認 `cd backend && pnpm lint && pnpm test && pnpm build`
2. **backend: openapi.json 再生成**（`pnpm openapi:export`）— 完了確認 `/auth/signup-config` が `openapi.json` に出現
3. **frontend: getSignupConfig + login/signup 出し分け + schema.d.ts 再生成** — 完了確認 `cd frontend && pnpm lint && pnpm build`
4. **docs: 実装計画追記の反映**（本節）— 完了確認 `npx markdownlint-cli 'docs/**/*.md'`

### 13.3 テスト方針

- backend は Jest ユニット。`signup`/`confirmSignup`（ON は従来通り成功・OFF は `ForbiddenException`）、`getSignupConfig`（ON→`{enabled:true}` / OFF→`{enabled:false}`）を追加でカバー。既存テストは `configValues` 既定 `true` で不変。
- frontend はユニット無し。`pnpm build` で型・ビルドを担保。
- 完全な手動確認（§11）は env 切替後に実機で行う。

### 13.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: エラーメッセージ文言の微調整、ローディング表示の見た目、`getSignupConfig` の失敗時フォールバック（false 固定）、テストスキャフォールドの形。
- **中断して相談**:
  - env 単一ソース方針を覆す必要が出た場合（フロント env 併用等）
  - OFF 時ステータスを 403 以外に変える必要が出た場合
  - 公開エンドポイントのパス/レスポンス形を変える必要が出た場合
  - DB スキーマ・API 仕様・トランザクション境界の変更が必要になった場合

### 13.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | env の真偽化 | `=== 'true'` のみ true。未設定/空/その他は false（デフォルト OFF・フェイルセーフ） |
| 2 | ガード例外 | `ForbiddenException`（403）。signup と confirm-signup の両方に適用 |
| 3 | config 取得 API | `GET /auth/signup-config`（`@Public`・200・`{enabled}`）。`AuthService.getSignupConfig()` |
| 4 | 既存テスト破壊回避 | `configValues` 既定に `SELF_SIGNUP_ENABLED:'true'`、OFF は `buildService` の config override で検証 |
| 5 | フロント config 取得失敗時 | enabled=false 扱い（登録導線を出さないフェイルセーフ） |
| 6 | login の config 取得経路 | `use-login-page` から `useAuthApi().getSignupConfig` を直接呼ぶ（AuthContext は介さない） |
| 7 | signup ページの読込中表示 | `configStatus='loading'` 中はフォームもメッセージも出さずローディング表示（出してから消えるチラつき回避） |
| 8 | openapi 再生成 | backend `openapi.json` と frontend `schema.d.ts` を再生成しコミット（既存慣習） |
