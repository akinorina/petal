# TSK-134 チャットのデザインを既存ページに揃える

- Notion: [TSK-134](https://app.notion.com/p/3889ca7d99dc809fa34cc334f8f7c4b9)
- 重要度: MIDDLE / 規模: L

## 課題サマリ（Notion 課題シート転記・フリーズ済み）

- **一行サマリ**: LLM チャットのユーザー会話バブルの青（`bg-blue-600`）がデザインシステムから浮いている。チャット周辺の生 Tailwind 色を design-system のセマンティックトークンへ統一する。
- **背景・動機**: 全体を design-system リポジトリ（`akinorina/design-system`）に従って統一しているが、LLM チャット画面のユーザー会話部分の青が派手に目立ち、デザインシステムに従っていない。
- **完了条件（確定）**: `frontend/src/components/chat/` 配下の生 Tailwind 色（`blue-*` / `zinc-*` / `bg-white` / `text-white` / `text-red-*` 等）を、design-system の公開ユーティリティ（`bg-accent-*` / `bg-surface-*` / `text-text-*` / `border-border-*` / `text-feedback-*` / `bg-neutral-*` 等）へ置き換え、全体と統一感のある見た目にする。
- **スコープ外**:
  1. petal 独自コンポーネントの design-system リポジトリへの複製・統一・再統合（**別タスクへ分離**。Notion に follow-up 起票予定）。
  2. chat 以外の独自コンポーネント（`InstallPrompt` / `UpdateNotice` / `PasswordPolicyChecklist` 等）の色統一。
  3. 機能変更・レイアウト再設計・DOM 構造変更。
- **制約**: design-system のトークン（`@theme` 公開ユーティリティ）経由で色指定し、生カラー（Tailwind 既定パレット `blue`/`zinc`/`red` や `#hex`）の直書きを禁止する。ライト/ダーク両対応を壊さない。
- **不明点・迷い**: なし（Phase 2 で解決。バブルの新配色は Phase 3 で決定）。

## スコープ

### 対象

`frontend/src/components/chat/` 配下の、生 Tailwind 色を含む 10 ファイル:

- `ChatConversation.tsx`（バブル本体・入力欄枠・空状態）
- `MessageAttachments.tsx`（ユーザーバブル内 画像サムネ）
- `MessageAudioAttachments.tsx`（ユーザーバブル内 音声）
- `ImageAttachmentPicker.tsx`（画像選択 Dialog）
- `AudioAttachmentPicker.tsx`（音声選択 Dialog）
- `AttachmentPreviewList.tsx`（入力欄上 画像プレビュー）
- `AudioAttachmentPreviewList.tsx`（入力欄上 音声プレビュー）
- `ImageThumb.tsx`（サムネの読込中/失敗）
- `AudioPlayer.tsx`（プレイヤーの読込中/失敗）
- `ChatPanel.tsx`（読込中表示）

### 対象外

- `MarkdownContent.css` / `MarkdownContent.tsx`（既に DS トークンのみ使用済み。変更不要）。
- chat 以外の全ファイル。
- ロジック（`use-*.ts`）・DOM 構造・機能。

## 制約

- 色は必ず design-system の公開トークン経由（`bg-accent-subtle-bg` / `text-text-primary` / `border-border-subtle` / `text-feedback-danger-default` / `bg-neutral-800` 等）で指定する。
- 生の Tailwind 既定色（`blue` / `zinc` / `gray` / `slate` / `red` / `white` / `black`）を新たに使わない。
- ライト/ダークはセマンティックトークンが自動追従する（現状の生色は非追従だったため、本変更で dark 対応も改善する）。
- 変更は色ユーティリティのクラス置換に限定し、レイアウト系ユーティリティ（余白・角丸・flex 等）や DOM は触らない。

## 設計判断ログ

### 判断 1: ユーザー会話バブルの新配色 —「アクセント淡色チント」を採用

- **採用案**: ユーザーバブル = `bg-accent-subtle-bg` + `text-accent-subtle-fg`（coral-50 背景 / coral-700 文字）、アシスタントバブル = `bg-surface-sunken` + `text-text-primary`。
- **理由**: 「ユーザー発言＝ブランド色（coral）」の識別性を保ちつつ、旧 `bg-blue-600`（DS 外の派手な青塗りつぶし）の“浮き”を解消する。淡色チントは周囲の暖色ニュートラル基調に馴染み、課題の主題を最も自然に解決する。両バブルが落ち着いたトーンで揃う。
- **却下案 A（アクセント塗りつぶし `bg-accent-default`/白文字）**: coral-500 の塗りつぶしは彩度が高く、青ほどではないがバブルが色として立ちすぎる。→ 却下。
- **却下案 B（ニュートラル統一）**: 色差をほぼ無くし配置のみで区別。最も静かだが、ユーザー/アシスタントの視認性が落ちる。→ 却下。
- **却下案 C（DS info トーン）**: 青みを残せるが、ブランドのアクセントは coral であり、info（青系）を会話主体色に使うのは意味論的に不整合。→ 却下。

### 判断 2: 生色 → DS トークンのマッピング原則

用途に応じてトークン種別を選ぶ。

- **面（背景・コンテナ）** → セマンティック `surface-*`（`bg-surface-sunken` / `bg-surface-raised`）。
- **文字** → セマンティック `text-*`（`text-text-primary` / `text-text-secondary` / `text-text-tertiary`）。
- **境界線** → セマンティック `border-*`（`border-border-subtle` / `border-border-default` / `border-border-strong`）。
- **選択・アクティブ状態** → アクセント（`border-accent-default` / `bg-accent-default` + `text-accent-on-accent` / `hover:border-accent-default`）。
- **エラー文字** → `text-feedback-danger-default`。
- **装飾的な濃色チップ（×/✓ バッジ等）** → ニュートラル原色トークン `bg-neutral-800` + `text-neutral-50`（DS パレット内。セマンティックに該当語彙が無いため原色プリミティブを使う）。

### 判断 3: 旧「濃い青バブル前提」の装飾の再調整

バブル内添付の装飾は旧・濃い青バブル（暗背景）前提で `white/40` 枠・`white/10` 面・`opacity-*` 文字を使っていた。淡色チント（明背景）では不可視・不整合になるため、明背景で成立する値へ置き換える。

- `MessageAttachments.tsx` サムネ枠 `border-white/40 bg-zinc-100` → `border-border-default bg-surface-sunken`。
- `MessageAudioAttachments.tsx` 音声行 `bg-white/10` → `bg-surface-raised`（coral-50 バブル上に白カードで浮かせる）。ラベル文字は `opacity-90` → `text-text-secondary`、再生時間 `opacity-75` → `text-text-tertiary`（opacity 依存をやめ、明示トークンにする）。

## 完全マッピング表（生色 → DS トークン）

| ファイル:行 | 現状 | 置換後 | 用途 |
| --- | --- | --- | --- |
| ChatConversation.tsx:108 | `text-zinc-400` | `text-text-tertiary` | 空状態テキスト |
| ChatConversation.tsx:133 | `border-zinc-200 bg-white` | `border-border-subtle bg-surface-raised` | 入力欄上枠 |
| ChatConversation.tsx:221 | `bg-blue-600 text-white` | `bg-accent-subtle-bg text-accent-subtle-fg` | **ユーザーバブル** |
| ChatConversation.tsx:222 | `bg-zinc-100 text-zinc-900` | `bg-surface-sunken text-text-primary` | アシスタントバブル |
| ChatConversation.tsx:239 | `text-zinc-400` | `text-text-tertiary` | pending「…」 |
| MessageAttachments.tsx:44 | `border-white/40 bg-zinc-100` | `border-border-default bg-surface-sunken` | バブル内サムネ枠（判断3） |
| MessageAudioAttachments.tsx:38 | `bg-white/10` | `bg-surface-raised` | バブル内音声行（判断3） |
| MessageAudioAttachments.tsx:39 | `opacity-90` | `text-text-secondary` | 音声ラベル（判断3） |
| MessageAudioAttachments.tsx:43 | `opacity-75` | `text-text-tertiary` | 再生時間（判断3） |
| ImageThumb.tsx:54 | `bg-zinc-100 text-zinc-500` | `bg-surface-sunken text-text-tertiary` | 読込失敗ボックス |
| ImageThumb.tsx:71 | `bg-zinc-200` | `bg-surface-sunken` | 読込中プレース |
| AudioPlayer.tsx:53 | `text-zinc-500` | `text-text-tertiary` | 読込失敗 |
| AudioPlayer.tsx:67 | `bg-zinc-200` | `bg-surface-sunken` | 読込中プレース |
| ChatPanel.tsx:30 | `text-zinc-500` | `text-text-tertiary` | 読込中 |
| AttachmentPreviewList.tsx:34 | `border-zinc-200 bg-zinc-100` | `border-border-subtle bg-surface-sunken` | サムネ枠 |
| AttachmentPreviewList.tsx:42 | `bg-zinc-800 text-white` | `bg-neutral-800 text-neutral-50` | × 削除バッジ |
| AudioAttachmentPreviewList.tsx:35 | `border-zinc-200 bg-zinc-50` | `border-border-subtle bg-surface-sunken` | 行枠 |
| AudioAttachmentPreviewList.tsx:37 | `text-zinc-800` | `text-text-primary` | タイトル |
| AudioAttachmentPreviewList.tsx:40 | `text-zinc-500` | `text-text-tertiary` | 再生時間 |
| AudioAttachmentPreviewList.tsx:48 | `bg-zinc-800 text-white` | `bg-neutral-800 text-neutral-50` | × 削除バッジ |
| ImageAttachmentPicker.tsx:48 | `text-zinc-500` | `text-text-tertiary` | 読込中 |
| ImageAttachmentPicker.tsx:50 | `text-red-600` | `text-feedback-danger-default` | エラー |
| ImageAttachmentPicker.tsx:63 | `text-zinc-500` | `text-text-tertiary` | 補助テキスト |
| ImageAttachmentPicker.tsx:82 | `border-blue-500` / `border-zinc-200` | `border-accent-default` / `border-border-subtle` | 選択/未選択枠 |
| ImageAttachmentPicker.tsx:83 | `hover:border-blue-300` | `hover:border-accent-default` | ホバー |
| ImageAttachmentPicker.tsx:86 | `bg-zinc-100` | `bg-surface-sunken` | サムネ背景 |
| ImageAttachmentPicker.tsx:89 | `bg-blue-600 text-white` | `bg-accent-default text-accent-on-accent` | 選択 ✓ バッジ |
| AudioAttachmentPicker.tsx:50 | `text-zinc-500` | `text-text-tertiary` | 読込中 |
| AudioAttachmentPicker.tsx:52 | `text-red-600` | `text-feedback-danger-default` | エラー |
| AudioAttachmentPicker.tsx:65 | `text-zinc-500` | `text-text-tertiary` | 補助テキスト |
| AudioAttachmentPicker.tsx:79 | `border-blue-500` / `border-zinc-200` | `border-accent-default` / `border-border-subtle` | 選択/未選択行枠 |
| AudioAttachmentPicker.tsx:83 | `text-zinc-900` | `text-text-primary` | タイトル |
| AudioAttachmentPicker.tsx:86 | `text-zinc-500` | `text-text-tertiary` | メタ情報 |
| AudioAttachmentPicker.tsx:102 | `border-blue-600 bg-blue-600 text-white` | `border-accent-default bg-accent-default text-accent-on-accent` | 選択 ✓ |
| AudioAttachmentPicker.tsx:103 | `border-zinc-300 text-transparent` | `border-border-strong text-transparent` | 未選択 ✓ 枠 |
| AudioAttachmentPicker.tsx:106 | `hover:border-blue-300` | `hover:border-accent-default` | ホバー |

## データモデル

変更なし。

## API 仕様

変更なし。

## トランザクション境界

該当なし（DB・外部副作用を伴わない、フロントエンドの表示スタイルのみの変更）。

## 既存設計との差分

- チャット周辺は生 Tailwind パレット（`blue`/`zinc`/`red`/`white`）を直書きしていた（DS パレット外）。本変更で全て DS 公開トークンへ置換する。
- `MarkdownContent.css` は既に DS トークン運用の先例。本変更で chat 全体をその方針に揃える。
- 副次効果として、セマンティックトークンは dark（`[data-theme="dark"]` / `.dark`）に自動追従するため、従来非追従だったチャットの dark 表示が改善する。

## 完了条件（具体化版）

- [ ] 上記マッピング表のとおり、対象 10 ファイルの生 Tailwind 色がすべて DS トークンへ置換されている。
- [ ] `frontend/src/components/chat/` 配下に `blue-` / `zinc-` / `gray-` / `slate-` / `red-` / `bg-white` / `text-white` / `border-white` / `bg-black` の生色クラスが残っていない（`MarkdownContent.*` を除く全 `.tsx`）。
- [ ] `pnpm lint` / 型チェック（`pnpm build` 相当）が通る。
- [ ] ユーザーバブルが淡い coral チント（青ではない）で表示され、全体の暖色基調に馴染む。
- [ ] 添付（画像サムネ・音声）がバブル内・入力欄上・Dialog のいずれでも視認性を保って表示される（判断3 の再調整が効いている）。

## 手動動作確認シナリオ

前提: `cd frontend && pnpm dev` で起動し、ログイン後 `/chat`（新規会話）を開く。

1. テキストを送信 → **ユーザーバブルが淡い coral チント（`bg-accent-subtle-bg`）で表示**され、青くない・派手でないこと。アシスタント応答バブルが `bg-surface-sunken` のニュートラルで表示されること。
2. 画像を添付して送信 → 入力欄上プレビュー・送信後バブル内サムネ・Dialog 原寸プレビューのいずれも枠と背景が視認できること（白飛び・不可視がないこと）。
3. 音声を添付して送信 → 入力欄上プレビュー行・バブル内音声行が白カードで浮き、ラベル/再生時間が読めること。
4. 画像/音声選択 Dialog を開く → 選択済み項目の枠・✓ バッジが coral（アクセント）、未選択がニュートラル、ホバーで枠がアクセントに変わること。エラー時の文言が danger 色で出ること（回線遮断等で確認できれば）。
5. 送信失敗・読込失敗を誘発（任意）→ 失敗プレース/エラーテキストが DS トークン色で表示されること。
6. ダーク切替（`<html>` に `data-theme="dark"` を付与できる場合）→ バブル・面・文字が破綻なく反転すること。

## 未確定事項

なし（マッピング表で全判断ポイントを確定）。

## 実装計画

### 変更・追加ファイル

追加なし。以下 10 ファイルの**色ユーティリティのクラス文字列のみ**をマッピング表どおり置換する（レイアウト系ユーティリティ・DOM・ロジックは不変）。

- `frontend/src/components/chat/ChatConversation.tsx`
- `frontend/src/components/chat/MessageAttachments.tsx`
- `frontend/src/components/chat/MessageAudioAttachments.tsx`
- `frontend/src/components/chat/ImageThumb.tsx`
- `frontend/src/components/chat/AudioPlayer.tsx`
- `frontend/src/components/chat/ChatPanel.tsx`
- `frontend/src/components/chat/AttachmentPreviewList.tsx`
- `frontend/src/components/chat/AudioAttachmentPreviewList.tsx`
- `frontend/src/components/chat/ImageAttachmentPicker.tsx`
- `frontend/src/components/chat/AudioAttachmentPicker.tsx`

### migration・環境変数・依存追加

- なし。

### 作業順序（コミット単位）

1. **コミット1**: `fix(tsk-134): チャットバブルの配色をDSトークンへ統一`
   - `ChatConversation.tsx`（:108, :133, :221, :222, :239）、`MessageAttachments.tsx`（:44）、`MessageAudioAttachments.tsx`（:38, :39, :43）。課題の主題（青バブル）＋判断3の再調整。
   - 完了確認: 該当ファイルに `blue-`/`zinc-`/`bg-white`/`text-white`/`border-white`/`opacity-9`/`opacity-7` の色系残存なし。バブルが淡色チントで表示。
2. **コミット2**: `fix(tsk-134): 添付プレビュー・プレイヤーの配色をDSトークンへ統一`
   - `AttachmentPreviewList.tsx`、`AudioAttachmentPreviewList.tsx`、`ImageThumb.tsx`、`AudioPlayer.tsx`、`ChatPanel.tsx`。
   - 完了確認: 該当ファイルに生色残存なし。
3. **コミット3**: `fix(tsk-134): 添付選択Dialogの配色をDSトークンへ統一`
   - `ImageAttachmentPicker.tsx`、`AudioAttachmentPicker.tsx`。
   - 完了確認: 該当ファイルに生色残存なし。選択/未選択/ホバー状態がアクセント/ニュートラルで表示。

各コミット後および最終に、下記の機械検証を実行する。

### テスト方針

- 自動テストは対象外（表示スタイルのみ・ロジック不変）。
- **機械検証（全コミット完了後）**:
  - 生色残存チェック: `frontend/src/components/chat/` の `.tsx`（`MarkdownContent.tsx` 以外）に `-(blue|zinc|gray|slate|red)(-[0-9])?` / `bg-white` / `text-white` / `border-white` / `bg-black` が残っていないこと（grep で 0 件）。
  - `cd frontend && pnpm lint`。
  - `cd frontend && pnpm build`（または型チェック）が通ること。
- 「手動動作確認シナリオ」をユーザー評価（Phase 6）で確認。

### 想定外時の判断ルール

- **AI 単独判断 OK**: マッピング表に沿った色クラス置換、置換に伴う自明なリファクタ（例: 三項演算子のクラス配列の整形）。
- **中断して要相談**: マッピング表に無い箇所で生色を発見した場合、必要なトークンが `@theme` に存在しない場合、色変更のためにレイアウト/DOM/ロジック変更が必要と判明した場合、設計判断ログ（判断1〜3）を覆す必要が生じた場合。
- タスク固有: 置換後に淡色チントで著しく視認性が損なわれる箇所を発見した場合は、勝手に別配色へ変えず中断して相談する。

### 事前解決済みの判断ポイント

- ユーザーバブル配色 = `bg-accent-subtle-bg` + `text-accent-subtle-fg`（判断1）。
- 装飾濃色チップ（×/✓ 削除・選択バッジのうち“削除”系）= `bg-neutral-800` + `text-neutral-50`（判断2）。“選択”系 ✓ バッジ = `bg-accent-default` + `text-accent-on-accent`。
- バブル内添付装飾の再調整 = 判断3のとおり（サムネ枠 `border-border-default bg-surface-sunken`／音声行 `bg-surface-raised`／文字 `text-text-secondary`・`text-text-tertiary`）。
- `text-transparent` は据え置き（色トークン対象外）。
- コミットは領域別 3 分割。
