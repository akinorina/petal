# ヘッダのメールアドレス表示をユーザーメニューに変更 設計（TSK-106）

## 0. 課題シート（Notion 転記）

> Notion タスク: [ヘッダのメールアドレス表示を変更](https://app.notion.com/p/3749ca7d99dc809aba09eb7d88b0ab12)（TSK-106）

### 一行サマリ

ヘッダにログイン・E-mail アドレスを表示しているが別の表記に変更する。

### 背景・動機

スマフォでログインしたとき、メールアドレスの文字列長が長く、全てを表示すると端末の画面の横幅に入りきらない（現状ログアウトボタンが潰れてしまう）。ユーザーログイン状態を示すアイコンなどに変更するとよい。

### 完了条件（原文）

- スマフォ（iPhone SE など）で表示したとき、ヘッダの表示が変に改行されないこと
- プロフィールページなどへの遷移が正常にできること

### Phase 2 / 3 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 制御範囲 | **frontend のみ**。backend は変更なし |
| ヘッダ本体の表示 | メールアドレスのテキスト表示を廃止し、**ユーザーアイコン（汎用人型アイコン）のみ**表示 |
| アイコン操作 | アイコンをタップ / クリックで**メニュー**を開く |
| メニュー項目 | 「プロフィール」（`/me` へ遷移）＋「ログアウト」の 2 項目 |
| メールアドレス | ヘッダ本体からは消すが、**メニュー内（上部）に表示**して誰でログイン中か確認可能にする |
| PC / スマホ | **表示を統一**（PC でもアイコン表示） |
| 実装手段 | design-system の `Popover` + `Avatar` + `ListItem` を再利用（新規コンポーネントを作らない） |
| スコープ外 | `/me` 配下サブページ（パスワード変更等）へのメニュー導線追加。アイコン画像（アバター画像）アップロード機能 |

---

## 1. 課題サマリ

ログイン後シェル（route group `(admin)`）の TopBar 右スロット（`end`）が、現在「メールアドレスのテキストリンク（`/me`）＋ ログアウトボタン」を横並びで表示しており、狭幅端末でメールアドレスが折り返してログアウトボタンを潰している。これを**固定幅のユーザーアイコン（Avatar）1 つ**に置き換え、クリックで開くメニュー（Popover）内に「メールアドレス表示／プロフィール遷移／ログアウト」を集約する。frontend のみの変更。

## 2. スコープ

### 対象

- `frontend/src/app/(admin)/layout.tsx` の TopBar `end` スロット
- 上記から呼ぶ既存フック `use-admin-layout.ts`（`email` / `role` / `handleLogout` は既存で充足。変更不要の見込み）

### 対象外

- backend API（変更なし）
- `/me` 配下のサブページ（`/me/password` 等）へのメニュー導線追加
- アバター画像のアップロード／表示（人型フォールバックアイコン固定）
- TopBar 左側のナビ（画像 / ユーザー / 監査ログ）の挙動 — 既存のまま

## 3. 制約

- frontend のみ。backend・DB・環境変数の変更なし。
- 既存の design-system コンポーネントのみを使い、新規コンポーネントは追加しない。
- オニオン依存方向・`'use client'` 配置など既存規約を維持。

## 4. 設計判断ログ

### 判断 1: メニューの実装手段 — Popover + Avatar + ListItem を再利用（採用）

- **採用**: design-system の `Popover`（`Trigger` / `Content` / `Close` コンパウンド）を使う。トリガーに `Avatar`、メニュー項目に `ListItem` を使う。
- **理由**: `Popover` は Esc・外側クリックで閉じる挙動とフォーカス管理（`FloatingFocusManager`）を内蔵。アクセシビリティと開閉挙動を自前実装せずに済む。
- **却下**: `useState` + 絶対配置の自前 dropdown → 閉じる挙動・フォーカストラップ・aria を再実装することになり車輪の再発明。

### 判断 2: トリガーの見た目 — Avatar の人型フォールバック（採用）

- **採用**: `Avatar`（`src` 無指定でデフォルト人型 SVG を表示、`size="sm"`）を `<button>` でラップし、`aria-label="アカウントメニュー"` を付与。
- **理由**: `Avatar` は固定幅のため狭幅でも折り返さない。`src` 無指定時にデフォルトで人型アイコンを描画する仕様が今回の用途に一致。
- **補足**: `Popover.Trigger` に渡す単一要素は `<button>`（クリック領域・`aria-expanded` 転送のため）。`Avatar` 自体は `<span>` なので button の内側に置く。

### 判断 3: メニュー内レイアウト — メール（上部）→ プロフィール → ログアウト（採用）

- **採用**: メニュー先頭に**メールアドレスの説明テキスト**（非操作・小さめ）、続けて `ListItem as="a" href="/me"`（プロフィール）、`ListItem as="button"`（ログアウト）。
- **理由**: 「誰でログイン中か」を上部のヘッダ情報として示し、操作項目（プロフィール / ログアウト）と視覚的に分離する。

### 判断 4: 狭幅対応の検証 — iPhone SE 幅（375px）で手動確認（採用）

- Avatar が固定幅なので `end` スロットは折り返さない。完了条件どおり 375px で手動確認する。

## 5. UI イメージ（ASCII モックアップ）

### 変更前（現状）

```text
┌────────────────────────────────────────────────────────────┐
│ Petal  画像 ユーザー 監査ログ      user@example.com  ログアウト │  ← 狭幅で
└────────────────────────────────────────────────────────────┘     折り返す
```

### 変更後（ヘッダ）

```text
┌──────────────────────────────────────────┐
│ Petal  画像 ユーザー 監査ログ          (👤) │  ← アイコン 1 つ（固定幅）
└──────────────────────────────────────────┘
```

### 変更後（アイコンをクリック → メニューが開く）

```text
                                      (👤)
                              ┌──────────────────────┐
                              │ user@example.com      │  ← メール（非操作）
                              ├──────────────────────┤
                              │ プロフィール           │  → /me へ遷移
                              │ ログアウト             │  → logout()
                              └──────────────────────┘
```

## 6. データモデル / API 仕様

- 変更なし。`email` / `role` / `logout` は既存の `useAuth()`（AuthContext）から取得済み。

## 7. 既存設計との差分

- [docs/67_admin-only-nav-guard.md](67_admin-only-nav-guard.md) で整備した `(admin)/layout.tsx` の TopBar 構成のうち、**`end` スロットのみ**を変更する。`start` スロット（ロゴ＋ナビ、admin 出し分け）は変更しない。
- `Popover` / `Avatar` は design-system に実装済みだが app 配下で初めて使用する。

## 8. 完了条件（具体化版）

- [ ] ヘッダ右に Avatar アイコン 1 つだけが表示され、メールアドレスのテキストは消えている
- [ ] iPhone SE 幅（375px）でヘッダが折り返さず、要素が潰れない
- [ ] アイコンをクリック / タップするとメニューが開く
- [ ] メニュー内に現在のログインメールアドレスが表示される
- [ ] メニューの「プロフィール」で `/me` へ遷移できる
- [ ] メニューの「ログアウト」でログアウトし `/login` へ遷移する
- [ ] Esc キー / 外側クリックでメニューが閉じる
- [ ] `cd frontend && pnpm build` が通る

## 9. 手動動作確認シナリオ

1. admin / 一般ユーザーそれぞれでログインし `/images` を開く。
2. ブラウザ幅を 375px（iPhone SE 相当）にしてヘッダが折り返さないことを確認。
3. ヘッダ右のアイコンをクリックしてメニューが開くことを確認。
4. メニュー上部に自分のメールアドレスが表示されることを確認。
5. 「プロフィール」をクリックして `/me` へ遷移することを確認。
6. 再度アイコンを開き「ログアウト」をクリックして `/login` へ遷移することを確認。
7. メニューを開いた状態で Esc / 外側クリックで閉じることを確認。

## 10. 未確定事項

- なし（Phase 2 / 3 で全方針確定）。

---

## 11. 実装計画（Phase 4）

### 11.1 変更・追加ファイル

| ファイル | 変更内容 |
| ---- | ---- |
| `frontend/src/app/(admin)/layout.tsx` | TopBar `end` スロットを「メールリンク＋ログアウトボタン」から `Popover` + `Avatar` + `ListItem` のユーザーメニューに置換。`Popover` / `Avatar` / `ListItem` を import 追加。`goToProfile` をフックから受け取る |
| `frontend/src/app/(admin)/use-admin-layout.ts` | `goToProfile`（`router.push('/me')`）ハンドラを追加し返り値に含める |

- migration / 環境変数 / 依存追加: **なし**。

### 11.2 メニュー構造（実装イメージ）

```tsx
<Popover placement="bottom-end">
  <Popover.Trigger>
    <button type="button" aria-label="アカウントメニュー" className="...">
      <Avatar size="sm" alt="" />
    </button>
  </Popover.Trigger>
  <Popover.Content className="p-0" aria-label="アカウントメニュー">
    <div className="...truncate...">{email}</div>      {/* 非操作のメール表示 */}
    <Popover.Close>
      <ListItem as="button" size="sm" title="プロフィール" onClick={goToProfile} />
    </Popover.Close>
    <Popover.Close>
      <ListItem as="button" size="sm" title="ログアウト" onClick={handleLogout} />
    </Popover.Close>
  </Popover.Content>
</Popover>
```

- プロフィールも `ListItem as="button"` + `goToProfile` で SPA 遷移に統一（既存 `handleLogout` と同パターン）。`as="a"` のネイティブ全リロードを避ける。
- `Popover.Close` が各項目クリック後にメニューを閉じる。
- `.ds-popover` の既定 padding は `className="p-0"` で打ち消し、ListItem を全幅表示。

### 11.3 作業順序（コミット単位）

1. **コミット 1**: `use-admin-layout.ts` に `goToProfile` を追加 → `(admin)/layout.tsx` の `end` スロットをユーザーメニューに置換。
   - 完了確認: `cd frontend && pnpm build` が通る／`pnpm lint` が通る／手動シナリオ（§9）を確認。

実装は 1 コミットにまとめる（同一の振る舞い変更で分割の意味が薄いため）。

### 11.4 テスト方針

- frontend はユニットテスト基盤の対象外（[docs/24_testing-strategy.md](24_testing-strategy.md) は backend 方針）。手動動作確認シナリオ（§9）で担保。
- `cd frontend && pnpm build` / `pnpm lint` の通過を必須とする。

### 11.5 想定外時の判断ルール

**AI 単独判断 OK**: 軽微な className 調整、Popover/Avatar/ListItem の props 微調整、設計スコープ内の追加実装。

**中断して要相談**:

- design-system コンポーネントに不足があり**新規コンポーネント追加や design-system 本体の改修**が必要になった場合。
- `Popover` のフォーカス管理がヘッダ内で破綻する等、設計方針（判断 1）を覆す必要が出た場合。
- メニュー項目・メール表示方針（Phase 2 / 3 で確定）を変える必要が出た場合。

### 11.6 事前解決済みの判断ポイント

| 判断ポイント | 解決 |
| ---- | ---- |
| プロフィール遷移を native `<a>` か SPA か | **SPA**（`goToProfile` = `router.push('/me')`）。既存 `handleLogout` と同パターン |
| Popover 内側 padding と ListItem 全幅の干渉 | `Popover.Content` に `className="p-0"` を付与（`:where()` 詳細度 0 で Tailwind が勝つ） |
| メニューの配置 | `placement="bottom-end"`（右端揃え） |
| Avatar のサイズ・画像 | `size="sm"`、画像なし（人型フォールバック）、装飾扱いで `alt=""` |
| トリガーの a11y | `<button type="button" aria-label="アカウントメニュー">` で `Avatar` をラップ |
| メールの折り返し | メニュー内で `truncate` + 最大幅指定 |
