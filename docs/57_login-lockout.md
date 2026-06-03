# 不正ログイン試行のロックアウト 設計（TSK-17）

## 0. 課題シート（Notion 転記）

> Notion タスク: [不正ログイン試行のロックアウト](https://app.notion.com/p/3589ca7d99dc81fbb623c241780c2622)（TSK-17）

### 背景

パスワード総当たり攻撃に対する保護がない。

### 課題（案）

- 案 A: Cognito Advanced Security Mode（追加課金）を ON にし、リスクベース対応 / 自動ロックを Cognito に委譲。
- 案 B: アプリ層でレート制限（例: 同一 email で 5 回失敗したら 15 分ロック）を実装。

### 完了条件（原文）

- 同一 email に対する短時間の連続失敗でロックされる
- ロック中は 429 を返す
- ロックは一定時間後に自動解除

### Phase 2 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 採用案 | **案 B（アプリ層レート制限）** |
| 失敗カウントのストア | **DB（Neon Postgres）**。Lambda 稼働のため in-memory は不可 |
| ロックのキー | **email のみ**（IP はログにのみ残す） |
| しきい値 / ロック時間 | **5 回 / 15 分**（環境変数で調整可・コードにデフォルト） |
| 適用範囲 | **`/auth/login` のみ** |

---

## 1. 課題サマリ

`/auth/login` に対するパスワード総当たり攻撃を緩和する。同一 email の連続ログイン失敗を DB のカウンタで数え、しきい値（既定 5 回）に達したら一定時間（既定 15 分）ロックして `429 Too Many Requests` を返す。ロックはロック期限の経過で自動解除する。失敗カウントの永続化先は、Lambda の多コンテナ環境でも一貫して機能するよう **DB（Neon）** とする。

## 2. スコープ

### 対象

- backend: `petal.login_attempts` テーブル追加（migration）
- backend: `LoginAttempt` ドメイン + リポジトリ I/F + TypeORM 実装（auth モジュール内）
- backend: `AuthService.login` にロック判定・失敗カウント・成功時リセットを組み込み
- backend: `429` 用の例外クラス追加
- backend: しきい値・ロック時間を環境変数化（デフォルト値あり）
- docs: `.envs/*.example` に環境変数を追記

### 対象外

- 案 A（Cognito Advanced Security Mode）
- Redis 等の新規ストア導入
- `/auth/login` 以外のエンドポイント（forgot-password / confirm-signup 等）
- 古い `login_attempts` 行の定期パージ（運用ジョブ＝[42_operational-jobs.md](42_operational-jobs.md) 側の別タスク）
- フロントエンドの変更（429 メッセージは既存のエラー表示で受ける）

## 3. 制約

- 本番は **AWS Lambda + serverless-express** 稼働。リクエストごとに別コンテナで実行され得るため、プロセスメモリ上の状態は共有されない（→ DB ストア必須）。
- オニオン依存方向を維持（Application は TypeORM/DataSource を直接 import せず、リポジトリ I/F 経由）。
- 物理削除なし（[00_rules.md §4](00_rules.md)）。ただし `login_attempts` は監査対象の業務データではなくレート制限用の揮発カウンタのため、**成功時・リセット時は行を物理削除**してよい（論理削除ルールの対象外。判断ログ参照）。
- `synchronize: false` 維持・migration で反映。

## 4. 設計判断ログ

### 判断 1: 失敗カウントのストア → **DB（Neon）**（採用）

- **採用**: `petal.login_attempts` テーブルにカウンタを持つ。
- **理由**: 本番は Lambda 稼働で、in-memory はコンテナごとに独立し同時並行・スケール時にロックが漏れ実質無効。DB なら多コンテナ間で一貫し、既存 Neon を使うため新規インフラ不要。ログイン頻度は管理アプリとして低く、1 回の read + 失敗時 upsert の負荷は軽微。
- **却下**: in-memory（タスク提案だが Lambda で機能しない）/ Redis（堅牢だが新規インフラ・コスト、将来課題）。

### 判断 2: ロックのキー → **email のみ**（採用）

- **採用**: email 単位で失敗を数える（タスク明記の「同一 email」）。
- **トレードオフ（account-lockout DoS）**: email 単位ロックは、攻撃者が標的 email でわざと失敗を重ねると正規ユーザーを一時的にログイン不能にできる。本アプリは管理者中心・小規模で影響は限定的なため許容する。将来 email+IP 併用や指数バックオフで緩和可能（別タスク）。
- IP は**ログにのみ**残す（保存しない。PII 配慮で warn ログ）。

### 判断 3: しきい値・ロック時間 → **5 回 / 15 分**（env 調整可・コードにデフォルト）

- `LOGIN_LOCKOUT_MAX_ATTEMPTS`（既定 5）/ `LOGIN_LOCKOUT_DURATION_MINUTES`（既定 15）。
- 環境変数未設定でも既定値で動作する（必須化しない）。

### 判断 4: テーブル設計 → **email を主キーにしたカウンタ行**（採用）

- 1 email = 1 行。`fail_count` を増分し、しきい値到達で `locked_until` をセット。
- 自動解除は `locked_until < now()` を「未ロック」と解釈する遅延方式（バッチ不要）。
- **却下**: 試行イベントを 1 行ずつ記録し time-window で COUNT する案（行数増・集計コスト）。

### 判断 5: enforcement の位置 → **`AuthService.login` 冒頭でロック判定**（採用）

1. login 開始時に `login_attempts` を引き、`locked_until > now()` ならロック中 → `429`（Cognito は呼ばない）。
2. Cognito 認証が**失敗**（認証拒否）→ 失敗を記録（`fail_count++`、到達で `locked_until` セット）。
3. Cognito 認証が**成功**（トークン/チャレンジ取得）→ カウンタをリセット（行削除）。

### 判断 6: 失敗としてカウントする条件 → **Cognito の認証拒否のみ**（採用）

- `authenticate()` が `null`（認証失敗）または `NotAuthorizedException` を投げたケースのみ失敗としてカウントする。
- ネットワーク/Cognito 5xx 等（`BadGatewayException` 相当）は**カウントしない**（攻撃ではなく障害のため）。
- 既存の `login` は全例外を `UnauthorizedException` 化していたが、`isNotAuthorized` 判定でカウント対象を切り分ける。

### 判断 7: 429 の表現 → **専用例外 `TooManyLoginAttemptsException`**（採用）

- `HttpException(message, 429)` を継承（`LastAdminConflictException` と同様のパターン）。
- メッセージは日本語の汎用文言。**`Retry-After` ヘッダや残ロック時間は返さない**（攻撃者にロック解除タイミングを与えない）。

### 判断 8: IP の扱い → **ログのみ**（採用）

- `@Ip()` で取得し、失敗時に `email + IP` を `warn` ログに残す（保存しない）。PII のためログレベルと取り扱いに留意。

### 判断 9: カウント窓 → **ロック時間と同一窓で古い失敗を破棄**（採用）

- 直近の失敗から `LOGIN_LOCKOUT_DURATION_MINUTES` 以上経過していれば、それまでの失敗は古いものとしてカウントを 1 から数え直す（緩やかな失敗の蓄積でロックされないように）。

### 判断 10: トランザクション境界 → **不要**（採用）

- カウンタの read-modify-write は競合し得るが、過剰カウント（安全側）も僅かな過小カウントも実害は小さい。厳密な原子性は不要で、`runInTransaction` は使わない。

## 5. データモデル

新規テーブル `petal.login_attempts`:

```sql
CREATE TABLE "petal"."login_attempts" (
    "email"           VARCHAR(255) NOT NULL,
    "fail_count"      INTEGER      NOT NULL DEFAULT 0,
    "first_failed_at" TIMESTAMPTZ,
    "locked_until"    TIMESTAMPTZ,
    "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_login_attempts_email" PRIMARY KEY ("email")
);
```

- migration: `database/migrations/1746144005000-CreateLoginAttemptsTable.ts`
- `users` テーブルとは FK で結ばない（存在しない email への試行も数え得るため）。

ドメイン `LoginAttempt`（auth/domain）: `email` / `failCount` / `firstFailedAt` / `lockedUntil` を持ち、`isLocked(now)` / `registerFailure(now, max, durationMs)` のポリシーメソッドを備える（純粋関数で単体テスト可能）。

## 6. API 仕様（`/auth/login` の挙動変更）

- 入力・正常時のレスポンスは現状維持（AUTHENTICATED / CHALLENGE / MFA_REQUIRED）。
- 追加挙動:
  - ロック中: `429 Too Many Requests`（`{"message": "ログイン試行回数が上限に達しました。しばらくしてから再度お試しください"}`）。Cognito は呼ばない。
  - 認証失敗: 既存どおり `401`。内部で失敗カウントを加算し、しきい値到達でロック。
  - 認証成功: 既存どおり 200。カウンタをリセット。
- コントローラは `@Ip()` でクライアント IP を取得し `AuthService.login(email, password, ip)` に渡す（ログ用途）。

## 7. シーケンス

```text
POST /auth/login {email,password}  (+ IP)
  AuthService.login
    1. attempt = loginAttemptRepo.findByEmail(email)
    2. if attempt.isLocked(now)        → throw 429（Cognito 未呼出）
    3. tokens = cognitoAuth.authenticate(email,password)
        3a. 認証拒否(null / NotAuthorized)
              → updated = attempt.registerFailure(now, MAX, DURATION)
              → loginAttemptRepo.save(updated)
              → warn ログ(email, IP)
              → throw 401
        3b. Cognito 障害(5xx) → カウントせず 401（既存挙動）
    4. 認証成功 → loginAttemptRepo.reset(email)（行削除）→ 200
```

## 8. トランザクション境界

判断 10 の通り DB トランザクションは使用しない（カウンタの read-modify-write は競合許容）。

## 9. 既存設計との差分

- `AuthService` に `ILoginAttemptRepository` を注入し、`login` のフローにロック判定・失敗記録・成功リセットを追加。
- `AuthModule` に `TypeOrmModule.forFeature([LoginAttemptEntity])` とリポジトリ provider を追加。
- 新規テーブル 1 つ（migration 追加）。`users` 等への影響なし。
- 環境変数 2 つ（任意・デフォルトあり）。

## 10. 完了条件（具体化）

- [ ] `petal.login_attempts` の migration が追加され、ローカルで `pnpm migration:run` が通る
- [ ] 同一 email で連続 `LOGIN_LOCKOUT_MAX_ATTEMPTS` 回失敗するとロックされる
- [ ] ロック中の login は Cognito を呼ばず `429` を返す
- [ ] `locked_until` 経過後は再びログイン試行でき、成功でカウンタがリセットされる
- [ ] Cognito 障害（5xx 相当）は失敗カウントに含めない
- [ ] 失敗時に `email + IP` が warn ログに出る
- [ ] `AuthService` の新ロジックにユニットテストがある（lock 判定 / 加算 / リセット / 障害は非カウント）
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` が通る
- [ ] `.envs/*.example` と本設計書の markdownlint が通る

## 11. 手動動作確認シナリオ

1. 既存ユーザーで**わざと誤ったパスワード**を 5 回連続入力 → 5 回目以降の応答が `429` になる。
2. ロック中に**正しいパスワード**でログインしても `429`（ロック優先）。
3. `LOGIN_LOCKOUT_DURATION_MINUTES` 経過後に正しいパスワードでログイン → 成功し `/images` に到達。
4. 一度成功した後は、再び誤入力してもカウントが 1 から数え直される（前回の失敗が残っていない）。
5. バックエンドログに失敗時の `email` と IP が warn で出ている。
6. （任意）`LOGIN_LOCKOUT_MAX_ATTEMPTS=2` 等に変えて閾値が反映されることを確認。

## 12. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。実装計画は Phase 4 で本書末尾に追記する。
