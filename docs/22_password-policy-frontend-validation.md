# Petal - パスワードポリシー フロント事前検証 設計

対応タスク: **TSK-11「新パスワード入力時のフロント側ポリシー事前検証」**

関連ドキュメント:

- [docs/01_requirements.md](01_requirements.md)
- [docs/03_workflow.md](03_workflow.md)
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md)
- [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) §3.5 — User Pool パスワードポリシー（正本）
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — 初回ログイン（NEW_PASSWORD_REQUIRED）
- [docs/19_password-reset.md](19_password-reset.md) — パスワードリセット

---

## 1. スコープと完了条件

### 対象

- **Frontend のみ**:
  - パスワードポリシーをコード化した共通モジュール `frontend/lib/password-policy.ts` の新設。
  - パスワード入力中にポリシー充足状況を日本語チェックリストで表示する共通 UI コンポーネント `frontend/components/PasswordPolicyChecklist.tsx` の新設。
  - 既存 2 画面への適用:
    - `/login` の `NEW_PASSWORD_REQUIRED` ステップ（初回ログイン時の新パスワード設定）
    - `/forgot-password` の confirm ステップ（パスワードリセット）
  - 「新しいパスワード」と「確認」の不一致を即時に可視化。
  - サーバ送信前のクライアント側ガード（ポリシー違反 / 不一致時は送信ボタンを disabled）。

### 非対象

- 「自分のパスワード変更」画面の新規構築（ページ・バックエンド API ともに別タスクで扱う）。当該画面が新設される際に本モジュールを再利用する前提で API を設計する。
- バックエンド側の追加バリデーション。Cognito 側のポリシー検証が引き続き正本であり、本タスクは UX 改善のための事前検証に留める（多重防御）。
- ポリシーの動的取得（後述 §4 のとおり固定値で持つ）。

### 完了条件（Notion チケット転記）

- [ ] 入力中にポリシー違反が日本語で可視化される
- [ ] パスワード一致チェックが即時に出る
- [ ] 関係する 3 画面で同じバリデーションが使われている
  - 本タスクでは `/login`（NEW_PASSWORD_REQUIRED）と `/forgot-password` の 2 画面に適用する。3 画面目（自分のパスワード変更）は当該画面新設タスクで本モジュールを呼び出すことで満たす。

---

## 2. パスワードポリシー（正本: [docs/14](14_cognito-user-pool-setup.md) §3.5）

| 項目 | 値 |
| ---- | -- |
| 最小長 | 8 文字 |
| 大文字を含む | 必須（`A-Z`） |
| 小文字を含む | 必須（`a-z`） |
| 数字を含む | 必須（`0-9`） |
| 特殊文字を含む | 必須（Cognito が許可する記号集合） |

特殊文字（記号）の定義は AWS Cognito 公式の許可セットに揃える:

```
^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~ ` + = - (および空白)
```

> ⚠️ ポリシーは [docs/14](14_cognito-user-pool-setup.md) §3.5 を **正本** とし、変更があった場合は本ファイルと `frontend/lib/password-policy.ts` の双方を更新する。動的取得（バックエンド `.env` からの配信）は実装しない（クライアントシークレットの混入リスクが無く、変更頻度も極めて低いため）。

---

## 3. モジュール設計

### 3.1 `frontend/lib/password-policy.ts`

純関数のみで構成し、React に依存しない。

```ts
export const PASSWORD_POLICY = {
  minLength: 8,
} as const;

export type PasswordRuleKey =
  | 'minLength'
  | 'hasUpper'
  | 'hasLower'
  | 'hasDigit'
  | 'hasSymbol';

export type PasswordRule = {
  key: PasswordRuleKey;
  label: string; // 日本語ラベル（チェックリスト表示用）
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[];

export type PasswordCheckResult = {
  rules: { key: PasswordRuleKey; label: string; ok: boolean }[];
  allOk: boolean;
};

export function evaluatePassword(password: string): PasswordCheckResult;

export type PasswordFormCheckResult = {
  policyOk: boolean;          // ポリシー全件 OK
  match: boolean;             // 新パスワード === 確認用（ともに空文字でない）
  canSubmit: boolean;         // policyOk && match
  rules: PasswordCheckResult['rules'];
};

export function evaluatePasswordForm(
  password: string,
  confirm: string,
): PasswordFormCheckResult;
```

- `test` は `RegExp` ベース（Cognito 許可記号セットを単一の正規表現で持つ）。
- 全関数は純関数で副作用なし。Zod は使わず、UI レンダリング用途のため軽量実装に留める（バリデーション正本はバックエンド + Cognito）。

### 3.2 `frontend/components/PasswordPolicyChecklist.tsx`

```ts
type Props = {
  password: string;        // 入力中の新パスワード
  confirm?: string;        // 入力中の確認用パスワード（省略可）
  showMatch?: boolean;     // 一致チェック行を出すか（既定 true、ただし confirm 未指定時は出さない）
};
```

- 各ルールを ◯/× アイコン付きで縦に並べ、未充足は赤系・充足は緑系で表示。
- `confirm` が渡されかつ非空の場合、最終行に「新しいパスワードと一致」行を追加。
- 既存スタイル（zinc / Tailwind）と整合させる。

### 3.3 適用画面

#### `/login`（`app/login/page.tsx`, `use-login-page.ts`）
- `NEW_PASSWORD_REQUIRED` ステップで `<PasswordPolicyChecklist>` を表示。
- `handleNewPassword` の入口で `evaluatePasswordForm` を呼び、`canSubmit` が `false` なら API を叩かず内部状態のエラーで return（既存 `error` ステートを利用）。
- 送信ボタンは `canSubmit === false || isLoading` で `disabled`。

#### `/forgot-password`（`app/forgot-password/page.tsx`, `use-forgot-password-page.ts`）
- confirm ステップで同様に `<PasswordPolicyChecklist>` を表示。
- `handleConfirm` の入口で `evaluatePasswordForm` を呼び事前ガード。
- 送信ボタンは `canSubmit === false || isLoading` で `disabled`。

> サーバ側からの `InvalidPasswordException`（Cognito 由来）に対する日本語化はそのまま現状維持。事前検証で実質的に到達しなくなるが、二重防御として残す。

---

## 4. データモデル / API 仕様

本タスクは Frontend 完結のためデータモデル・API 変更なし。

---

## 5. シーケンス（NEW_PASSWORD_REQUIRED 例）

```
ユーザー        画面 (/login)            module
  | 入力中 ---->|
  |             | evaluatePasswordForm() ->|
  |             |<- rules / canSubmit -----|
  |             | チェックリスト即時更新
  |             | 送信ボタン disabled 制御
  | 送信 ------>|
  |             | canSubmit=false なら何もしない
  |             | canSubmit=true なら従来どおり API へ
```

---

## 6. トランザクション境界

該当なし（DB 書き込み・外部 API 呼び出しを伴わない、純粋なフロント UI 改善）。`docs/00_rules.md` §4 の DB UPDATE → 外部 API → COMMIT/ROLLBACK 原則は本タスクのスコープ外。

---

## 7. 既存設計との差分・整合性

- `docs/19_password-reset.md` §1「非対象」に「パスワードポリシーのフロント事前検証（別タスク化済み）」と明記済み。本タスクで解消する。
- `docs/15_user-management-enhancement.md` の初回ログインフローは API 仕様としては変更なし、フロント UI のみ改善。
- バックエンドの `cognito-auth.client.ts` の `InvalidPassword` ハンドリングは残置。

---

## 8. 手動動作確認シナリオ

### 8.1 `/login` 初回ログイン
- [ ] 招待直後ユーザーで初回ログインし `NEW_PASSWORD_REQUIRED` 画面へ遷移できる。
- [ ] 新パスワード欄が空のとき、5 ルール全てが × 表示。
- [ ] `abcdefgh`（小文字 8 文字）入力時、最小長・小文字のみ ◯、他は ×、送信ボタン disabled。
- [ ] `Abcdef1!` 入力時、5 ルール全て ◯、送信ボタンは確認欄が空または不一致なら disabled。
- [ ] 確認欄に `Abcdef1!` を入力すると「一致」◯、送信ボタン有効。
- [ ] 確認欄に `Abcdef1?` を入力すると「一致」×、送信ボタン disabled。
- [ ] 有効状態で送信するとパスワード設定が完了し通常通りログイン後画面へ遷移。

### 8.2 `/forgot-password` リセット
- [ ] メールアドレス送信 → 検証コード入力 → 新パスワード入力 confirm ステップに遷移できる。
- [ ] 8.1 と同様にチェックリスト・disabled 制御が動作。
- [ ] 有効状態で送信するとパスワード変更が完了し `/login` への誘導が表示。

### 8.3 共通
- [ ] 入力中、各ルールの ◯/× がリアルタイムに切り替わる（onChange ベース）。
- [ ] 既存の他画面（ログインの初回ステップ以外、画像管理等）に副作用がない。

---

## 9. 影響ファイル一覧（暫定）

新規:
- `frontend/lib/password-policy.ts`
- `frontend/components/PasswordPolicyChecklist.tsx`

変更:
- `frontend/app/login/page.tsx`（チェックリスト挿入、disabled 制御）
- `frontend/app/login/use-login-page.ts`（事前ガードロジック）
- `frontend/app/forgot-password/page.tsx`（同上）
- `frontend/app/forgot-password/use-forgot-password-page.ts`（同上）
- `AGENTS.md`（ドキュメント表に本ファイルを追記）
- `docs/19_password-reset.md`（§1「非対象」のリンク先を本ファイルに張る）

---

## 10. リスク・未確定事項

- `frontend/components/` ディレクトリは現状未作成のため新設する。既存 UI コンポーネントの整理方針が別途決まっている場合は配置先を再検討する。
- Cognito 公式の許可記号セットは将来変更される可能性があるため、定義箇所（`password-policy.ts`）に出典 URL コメントを残す。
