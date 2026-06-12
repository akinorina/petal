# PRJ-10 T3: インストール導線（Android プロンプト + iOS 案内）

PRJ-10「Petal PWA 化」の 3 番目のタスク。Android / Desktop Chrome では
`beforeinstallprompt` を捕捉して「ホーム画面に追加」ボタンを表示し、iOS Safari では
「共有 → ホーム画面に追加」の案内モーダルを表示する。却下・インストール済みは
localStorage に保存して再表示を抑制する。

- Notion プロジェクト: [PRJ-10 Petal PWA 化](https://www.notion.so/36d9ca7d99dc80fe8440fd2ba3cfe077)
- Notion タスク: [インストール導線（Android プロンプト + iOS 案内）](https://www.notion.so/36e9ca7d99dc81e799acf8495412f482)
- 前提: [docs/50_pwa-foundation.md](50_pwa-foundation.md)（T1 で manifest / SW 導入済み）
- 関連: [docs/51_sw-update-notice.md](51_sw-update-notice.md)（T2 で `SerwistProvider` 配下の
  バナー UI を導入済み）

## 課題サマリ

PRJ-10 / F-4 の要件に従い、ユーザーがホーム画面追加に踏み切る導線を提供する。Android /
Desktop Chrome は `beforeinstallprompt` を捕捉してネイティブの追加ダイアログを呼び出し、
iOS Safari は同イベントが発火しないため、共有メニュー経由の手順をモーダルで案内する。
どちらの経路でも「あとで」「インストール済み」は localStorage に保存して再表示を抑える。

## スコープ

### 対象

- `InstallPrompt` クライアントコンポーネント実装
  （`src/components/InstallPrompt.tsx`）。
  - Android / Desktop Chrome: `beforeinstallprompt` を捕捉 → 画面下部バナーに
    「ホーム画面に追加」ボタンを表示 → クリックで `prompt()` を呼び出し。
  - iOS Safari（スタンドアロン未起動）: バナーから「インストール手順」モーダルを開き、
    共有 → ホーム画面に追加の手順を画像 / アイコン付きで案内。
- 表示抑制（localStorage）:
  - 「あとで」押下時: `petal:install:dismissedAt` に ISO 日時を保存。
  - `appinstalled` イベント受信時: `petal:install:installed` を `"1"` に保存。
  - すでにスタンドアロン起動中（`display-mode: standalone` または
    `navigator.standalone === true`）は無条件に非表示。
- `layout.tsx` の `SerwistProvider` 配下に `InstallPrompt` をマウント。

### 対象外

- スタンドアロン起動の検出・計測（T4 / TSK-94）。
- Lighthouse PWA 監査の CI 組み込み（T5）。
- analytics へのインストール検知 / 却下イベント送出。
- 「あとで」の期限切れによる再表示（次の判断 2 参照）。
- ToastProvider / Modal の design-system 共通化（既存に共通 Modal がなければ本コンポーネント
  内のローカル実装に留める）。

## 設計判断ログ

### 判断 1: UI 形式

- **採用案**: T2 と同様、画面下部固定の **自前バナー**（design-system トークンを使用）。
  バナーには「ホーム画面に追加」（Android/Desktop は `prompt()`、iOS は手順モーダル起動）
  と「あとで」の 2 ボタンを置く。iOS 案内は **モーダル**（画面中央のダイアログ）で開く。
- **理由**:
  - T2 の `UpdateNotice` と一貫した UI で混乱を避ける。`UpdateNotice` と同時に表示されうるが、
    両者は `bottom-0` で縦に並べる（UpdateNotice を優先表示し、その上に InstallPrompt を積む
    か、同時表示は許容する）。同時発生はレアケース（更新通知中はバナーを抑制する案も検討したが、
    複雑化に見合わないため両方表示で許容）。
  - iOS の手順案内は**画像 / アイコン込みの説明**が必要なため、バナーに収めるよりモーダルが適切。
- **却下案**:
  - 案 X: ヘッダー / サイドバー内の固定ボタン — メニュー UI へ手を入れる範囲が広く、本タスクの
    スコープを超える。
  - 案 Y: トースト — sticky な確認 UI が望ましく、自動消失するトーストは不適切（T2 と同じ理由）。

### 判断 2: 「あとで」抑制の永続化方針

- **採用案**: **localStorage に保存し、以降は再表示しない**（恒久抑制）。
  ただし `appinstalled` 受信時もしくはユーザーがブラウザの localStorage をクリアしない限り
  バナーは出さない。
- **理由**:
  - Notion 完了条件「却下・インストール済みは localStorage で再表示を抑制」を字義通り満たす。
  - インストール導線は SW 更新通知と性格が異なり、繰り返し提示する利益が小さく、繰り返し提示の
    煩わしさのほうが大きい。アプリの動作には影響しない（インストールは任意）。
  - 別タスク（T4）でスタンドアロン計測を入れた後、analytics 連携で「N 日後再表示」等の高度な
    制御は再設計可能。今は最小実装に留める。
- **却下案**:
  - 案 X: 日数経過で再表示（例: 30 日後） — Notion 仕様にはない複雑化のため見送り。

### 判断 3: iOS 判定方法

- **採用案**: `navigator.userAgent` で `/iPad|iPhone|iPod/` を含み、かつ
  `(navigator as { standalone?: boolean }).standalone !== true` のとき iOS Safari と判定。
  iPadOS 13+ は UA に `iPad` を含まない（`MacIntel` + タッチ対応）ため、
  `navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)` も iOS 扱いとする。
- **理由**:
  - `beforeinstallprompt` は iOS で発火しないため、UA + standalone フラグで分岐するしかない。
  - Chrome on iOS など Safari 以外でも案内モーダルは害がない（ホーム画面追加は WebKit ベース
    全般で同じ手順）ため、iOS デバイス判定で十分とする（厳密な Safari 判定はしない）。
- **却下案**:
  - 案 X: User-Agent Client Hints — iOS Safari が未対応のため使えない。

### 判断 4: スタンドアロン判定

- **採用案**: `window.matchMedia('(display-mode: standalone)').matches` または
  `(navigator as { standalone?: boolean }).standalone === true` のいずれかが真ならスタンドアロン。
  スタンドアロン時はバナーを表示しない。
- **理由**: Notion「インストール済みは抑制」を **実機状態でも** 担保するため、localStorage に
  加えて起動モードでも判定する。

### 判断 5: dev 環境での挙動

- **採用案**: dev でも `beforeinstallprompt` を捕捉してバナーを表示する（SW とは独立した
  ブラウザ機能のため）。ただし `localhost` は Chrome が installable と判定するため、開発者が
  動作確認できるメリットがある。
- **理由**: SW は dev で無効だが、本機能は SW に依存しない。表示確認の容易さを優先する。

## シーケンス

### Android / Desktop Chrome

```text
ページロード
   │
   ▼
Chrome が installable 判定 → beforeinstallprompt 発火
   │
   ▼
InstallPrompt が event.preventDefault() で握り、deferredPrompt を保持
   │
   ├─ localStorage 抑制中 or スタンドアロン起動中 → 何もしない
   │
   ▼
バナー表示（「ホーム画面に追加」「あとで」）
   │
   ├─[「ホーム画面に追加」]
   │     deferredPrompt.prompt() → ユーザー選択
   │       ├─ 'accepted'  → ブラウザが appinstalled を発火（後述）
   │       └─ 'dismissed' → 「あとで」と同じ扱い（localStorage に dismissedAt 保存）
   │
   └─[「あとで」]
         localStorage に dismissedAt 保存 → バナー非表示

appinstalled イベント
   │
   ▼
localStorage に installed=1 保存 → 以降バナー表示なし
```

### iOS Safari

```text
ページロード
   │
   ▼
UA で iOS 判定、かつスタンドアロン未起動、かつ localStorage 抑制なし
   │
   ▼
バナー表示（「インストール方法を見る」「あとで」）
   │
   ├─[「インストール方法を見る」]
   │     モーダル表示:
   │       1. ブラウザ下部の「共有」ボタン（共有アイコン）をタップ
   │       2. メニューから「ホーム画面に追加」を選択
   │       3. 右上の「追加」をタップ
   │     [閉じる] でモーダルを閉じる（バナーは表示継続）
   │     [今後表示しない] で localStorage に dismissedAt 保存（バナー非表示）
   │
   └─[「あとで」]
         localStorage に dismissedAt 保存 → バナー非表示
```

## localStorage キー仕様

| キー | 値 | セットされる条件 |
| --- | --- | --- |
| `petal:install:dismissedAt` | ISO 8601 日時文字列 | 「あとで」/「今後表示しない」押下時 / Android の `userChoice` が `dismissed` |
| `petal:install:installed` | `"1"` | `appinstalled` イベント受信時 |

- どちらかが存在すればバナー / モーダルを表示しない。
- 値の妥当性検証はしない（不正値でも「抑制中」とみなす方が安全側）。
- キーの prefix `petal:install:` は将来 PRJ 内の他キー（例: `petal:standalone:*`）と
  衝突しないよう namespace を切る。

## 既存設計との差分・整合性

- T1 / T2 の manifest / SerwistProvider / UpdateNotice の構成を変更しない。
  `InstallPrompt` は `UpdateNotice` の隣に並べてマウントする。
- 既存の `(authenticated)` 認証ガード等、業務 UI には介入しない。バナー / モーダルは認証状態に
  関わらず表示する（インストール導線は誰でも見せて良い）。
- backend / migrations / `.env.example` の変更なし。
- design-system: `Button` / `Dialog` 既存コンポーネントを再利用する。iOS 案内モーダルは
  `Dialog` の compound API（`Dialog.Content` / `Header` / `Title` / `Body` / `Footer`）を
  controlled mode（`open` / `onOpenChange`）で使用する。

## 完了条件

- [ ] Android / Desktop Chrome で `beforeinstallprompt` を捕捉し、画面下部バナーに
      「ホーム画面に追加」ボタンが表示される。クリックでネイティブの追加ダイアログが開く。
- [ ] iOS Safari（iPhone / iPad）でバナーが表示され、「インストール方法を見る」で手順
      モーダルが表示される。
- [ ] 「あとで」/ Android の `userChoice` で `dismissed` のとき、localStorage に
      `petal:install:dismissedAt` が保存され、リロードしても再表示されない。
- [ ] `appinstalled` 受信時に `petal:install:installed=1` が保存され、以後表示されない。
- [ ] スタンドアロン起動中（`display-mode: standalone` または `navigator.standalone`）は
      バナー / モーダルが表示されない。
- [ ] 既存 UI（UpdateNotice 含む）にデグレなし。
- [ ] `cd frontend && pnpm lint && pnpm build` が通る（型エラーなし）。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

### Android / Desktop Chrome

1. localStorage の `petal:install:*` をクリアし、`pnpm build && pnpm start:prod` を起動。
2. Chrome（PC または Android）でトップを開く → 画面下部に「ホーム画面に追加」バナーが
   表示される。
3. 「ホーム画面に追加」を押下 → ネイティブのインストールダイアログが開く。
   「インストール」を選択 → アプリが追加され、バナーが消える。localStorage に
   `petal:install:installed=1` が入る。
4. localStorage を再度クリア → リロード → 再表示。今度は「あとで」を押下 → バナーが消える。
   リロードしても再表示されない。localStorage に `petal:install:dismissedAt` が入る。

### iOS Safari

1. localStorage を Safari の開発メニューでクリアし、iPhone / iPad Safari でアクセス。
2. 画面下部に「インストール方法を見る」「あとで」のバナーが表示される。
3. 「インストール方法を見る」をタップ → モーダルが開き、共有 → ホーム画面に追加の手順が
   表示される。
4. 手順に従ってホーム画面に追加 → ホーム画面のアイコンから起動 → スタンドアロン判定で
   バナーが**表示されない**ことを確認。
5. 一度 Safari の localStorage をクリアして再アクセス → 「あとで」をタップ → リロードしても
   再表示されない。

### スタンドアロン

1. すでにインストール済みの状態でアプリを起動（ホーム画面のアイコン or PC Chrome の
   アプリウィンドウ）→ バナーが**表示されない**ことを確認。

## 実装計画

### 変更・追加ファイル

- frontend/
  - `src/components/InstallPrompt.tsx`（新規・本コンポーネント本体）
  - `src/components/InstallInstructionsDialog.tsx`（新規・iOS 案内モーダル。
    InstallPrompt 内に同居でも可、レビュー後判断）
  - `src/app/layout.tsx`（`InstallPrompt` をマウント）
- docs/
  - `52_install-prompt.md`（本書）
  - `AGENTS.md` ドキュメント表に追記

### 必要な migration / 環境変数 / 依存追加

- 不要。

### 作業順序（コミット単位）

1. **コミット 1**: 設計ドキュメント追加（本書 + AGENTS.md）。
2. **コミット 2**: `InstallPrompt` 実装 + `layout.tsx` マウント。

### テスト方針

- 自動テスト: 書かない。`beforeinstallprompt` / `appinstalled` / iOS UA / `display-mode`
  は実機ブラウザ挙動が本質で、jsdom でのモックは検証価値が低い。手動動作確認シナリオで担保。

### 想定外時の判断ルール

- AI 単独判断 OK: design-system トークンの微調整、モーダルの内部実装方法、UA 判定式の
  正規表現微調整、`beforeinstallprompt` の型定義（DOM 標準型に無いため自前で型を当てる）。
- 中断して相談: design-system に Modal を新規追加すべきと判断した / Android で
  `beforeinstallprompt` が想定通り発火しない / Notion 要件と localStorage 仕様の解釈に
  ズレが疑われる、など設計を揺るがす事象。

### 事前解決済みの判断ポイント

- Q: UI 形式は？ → A: T2 と同じ画面下部バナー、iOS 案内はモーダル（判断 1）。
- Q: 「あとで」の永続化？ → A: localStorage で恒久抑制（判断 2）。
- Q: iOS 判定方法は？ → A: UA + standalone フラグ。iPadOS 13+ は maxTouchPoints も加味（判断 3）。
- Q: スタンドアロン判定は？ → A: `display-mode: standalone` または `navigator.standalone`（判断 4）。
- Q: dev で表示する？ → A: する（SW と独立した機能のため）（判断 5）。
