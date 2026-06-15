# Petal - ログイン後のデフォルトページを画像ページに変更 設計

対応タスク: Notion「ログイン後のデフォルトページを画像一覧ページに変更」  
親プロジェクト: PRJ-8「Petal 画像レイアウト・UIの充実」

## 1. スコープ

### 対象

- アプリ起動時の **ルート `/` の遷移先**を `/users` から `/images` に変更。
- **ログイン成功後のリダイレクト先**（通常ログイン・初回パスワード設定・MFA チャレンジ）を `/users` から `/images` に変更。
- 管理画面 `TopBar` のナビゲーション順序を「画像 → ユーザー → 監査ログ」に並び替え、画像が主要導線であることを視覚的に示す。

### 非対象

- 未ログイン時に保護ページへアクセスしたときのログイン誘導は **既存挙動を維持**（`useAdminLayout` が `/login` へ replace 済み）。ログイン後にアクセス元へ戻す deep-link 復元は本タスクで導入しない。
- 画像一覧ページ自体の実装変更（別タスク「画像一覧ページの実装（グリッド表示）」で扱う）。
- ヘッダー・ロゴクリック時の遷移先（現状は遷移なし。本タスクの範囲外）。

## 2. 既存設計との関係

- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — ログインフロー設計。本タスクはログイン成功後の **遷移先**のみを差し替え、認証ロジック自体は無変更。
- [docs/12_image-management.md](12_image-management.md) — 画像ページの仕様。`/images` ルートが認証必須であることに依存する（既存どおり `(authenticated)` レイアウト配下）。
- DB / API / 外部 SaaS の変更なし。トランザクション境界の検討事項なし（[00_rules.md §4](00_rules.md) 対象外）。

## 3. 変更点詳細

### 3.1 ルート遷移

`frontend/src/app/page.tsx`:

```diff
- redirect('/users');
+ redirect('/images');
```

### 3.2 ログイン成功時の遷移

`frontend/src/app/login/use-login-page.ts` の以下 3 箇所:

| 関数 | 既存 | 変更後 |
| ---- | ---- | ------ |
| `handleLogin`（通常ログイン成功） | `router.push('/users')` | `router.push('/images')` |
| `handleMfa`（MFA チャレンジ通過後） | `router.push('/users')` | `router.push('/images')` |
| `handleNewPassword`（初回パスワード設定後） | `router.push('/users')` | `router.push('/images')` |

ログイン成功時に元々訪れたかった URL（`returnTo` 的なクエリ復元）は **本タスクのスコープ外**。Notion チケットの「ログイン後のデフォルト遷移先を画像ページに」要件に合致する最小実装に留める。

### 3.3 ナビゲーションの並び順

`frontend/src/app/(authenticated)/layout.tsx` 内 `<nav>` の `NavLink` 順序を変更:

```diff
- <NavLink href="/users" ...>ユーザー</NavLink>
- <NavLink href="/images" ...>画像</NavLink>
- <NavLink href="/audit-logs" ...>監査ログ</NavLink>
+ <NavLink href="/images" ...>画像</NavLink>
+ <NavLink href="/users" ...>ユーザー</NavLink>
+ <NavLink href="/audit-logs" ...>監査ログ</NavLink>
```

`pathname.startsWith()` ベースの `active` 判定はそのまま流用するため、初期表示で `/images` を開いた時点で「画像」がアクティブになる（特別な初期選択処理は不要）。

## 4. 未ログイン時の挙動

`useAdminLayout` の `useEffect` が `isAuthenticated === false` のときに `router.replace('/login')` を実行する既存ロジックは無変更。`/images` へ未ログインでアクセスした場合も同じ経路でログインへ誘導される（要件「未ログイン時にアクセスした場合はログインへ誘導」を既存実装で満たしている）。

ログイン後の戻り先は本タスクではハードコード（`/images`）。アクセス元に戻る挙動（`returnTo`）は将来タスクで検討。

## 5. 完了条件

- [ ] `/` にアクセスすると `/images` へリダイレクトされる（未ログインなら最終的に `/login`）。
- [ ] ログイン成功時に `/images` へ遷移する（通常／MFA／初回パスワード設定 の 3 経路）。
- [ ] `TopBar` ナビゲーションの並びが「画像 → ユーザー → 監査ログ」になる。
- [ ] `/images` を `pathname.startsWith` で判定する `active` ハイライトが従来どおり動作する。
- [ ] `pnpm --filter frontend build` が通る。

## 6. 手動動作確認シナリオ

1. ログアウト状態で `/` を開く → `/login` に到達する（経路: `/` → `/images` → `/login`）。
2. 有効な認証情報でログイン → `/images` に遷移し、画像ページが表示される。
3. 初回パスワード設定要求が来るユーザーでログイン → 新パスワード入力後 `/images` へ遷移する。
4. MFA 有効ユーザーでログイン → MFA コード入力後 `/images` へ遷移する。
5. `TopBar` の左から「画像」「ユーザー」「監査ログ」の順で並んでいる。`/images` 表示時に「画像」が太字（active）。
6. `/users` を開くと「ユーザー」が active になる（既存どおり）。
