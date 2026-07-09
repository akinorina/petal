# TSK-129 スマフォ表示が拡大縮小しないようにする

- Notion: [TSK-129](https://app.notion.com/p/3889ca7d99dc8000a7ecdf0dfbc41135)
- 重要度: HIGH

## 課題サマリ（Notion 課題シート転記・フリーズ済み）

- **一行サマリ**: スマフォの画面表示が拡大・縮小しないようにする。
- **背景・動機**: スマフォで画面を開いて操作していると、操作中に画面が拡大・縮小して使いづらい。抑止したい。
- **完了条件（確定）**: スマフォで以下がいずれも発生しないこと。
  1. ピンチ拡大（2本指）
  2. ダブルタップ拡大
  3. iOS Safari で入力欄タップ時の自動ズーム
- **スコープ外**: PC ブラウザの表示・操作挙動は変更しない。
- **制約**: アクセシビリティ（弱視ユーザーによる意図的な拡大）を犠牲にする点は許容する。
- **不明点・迷い**: なし（Phase 2 で解決）。

## スコープ

### 対象

- `frontend/src/app/layout.tsx` の `viewport` export
- `frontend/src/app/globals.css` のベーススタイル

### 対象外

- PC / デスクトップブラウザ向けの個別対応
- 個別入力欄の font-size 調整（下記「設計判断ログ」参照。viewport 側で iOS オートズームを抑止できるため不要と判断）

## 制約

- Next.js App Router の `Viewport` 型（`next`）に沿って設定する。
- 既存の `viewport` export（`themeColor: '#D9624A'`）を維持する。

## 設計判断ログ

### 判断 1: ズーム抑止の手段

- **採用案**: viewport 設定と CSS `touch-action` を**併用**する（ベルト＆サスペンダー）。
  - `viewport`: `initialScale: 1, maximumScale: 1, userScalable: false` を追加 → ピンチ拡大・iOS 入力オートズームを抑止。
  - `globals.css`: `html`（ルート）に `touch-action: manipulation` を追加 → ダブルタップ拡大をクロスブラウザで確実に抑止。
- **理由**: 単一手段では取りこぼしが出る。`touch-action: manipulation` はピンチを止めない。`user-scalable=no` / `maximum-scale=1` はブラウザ・バージョンによりダブルタップ抑止が不安定。両者を併用することで完了条件①②③を確実にカバーする。
- **却下案 A（viewport のみ）**: `maximum-scale=1` はダブルタップ抑止がブラウザ依存で不確実。→ 却下。
- **却下案 B（touch-action のみ）**: ピンチ拡大が残る。→ 却下。
- **却下案 C（入力欄 font-size ≥16px の個別対応）**: 全入力欄の走査・維持コストが高く、viewport 側で iOS オートズームを抑止できるため不要。→ 却下。

### 判断 2: `touch-action` の適用先

- **採用案**: `html` 要素に適用する。
- **理由**: ページ全体（body 配下すべて）に確実に継承・適用させるため。ルートに置くことでレイアウト個別実装に依存しない。

## データモデル

変更なし。

## API 仕様

変更なし。

## トランザクション境界

該当なし（DB・外部副作用を伴わない、フロントエンド表示設定のみの変更）。

## 既存設計との差分

- `viewport` export は現在 `themeColor` のみ。ここに拡大抑止の 3 プロパティを追加する。
- `globals.css` には現在 `html` / `body` に対するベースルールがない。`html` への `touch-action` ルールを新規追加する。

## 完了条件（具体化版）

- [ ] `layout.tsx` の `viewport` に `initialScale: 1`, `maximumScale: 1`, `userScalable: false` が追加され、`themeColor` が維持されている。
- [ ] `globals.css` に `html { touch-action: manipulation; }` 相当のルールが追加されている。
- [ ] `pnpm lint` / 型チェックが通る。
- [ ] スマホ実機（または DevTools デバイスモード）で ①ピンチ ②ダブルタップ ③iOS 入力欄タップ のいずれでも画面が拡大しない。

## 手動動作確認シナリオ

前提: `pnpm dev` で起動し、スマホ実機または Safari/Chrome の DevTools デバイスモードで開く。

1. 適当な画面で 2本指ピンチ操作 → **拡大しないこと**。
2. 文字・ボタン領域を素早く2回タップ（ダブルタップ）→ **拡大しないこと**。
3. iOS Safari 実機でテキスト入力欄をタップ → **画面が自動ズームしないこと**。
4. PC ブラウザで通常操作 → 従来どおり操作できること（デグレなし）。

## 未確定事項

なし。

## 実装計画

### 変更・追加ファイル

- `frontend/src/app/layout.tsx`: `viewport` export に `initialScale` / `maximumScale` / `userScalable` を追加（`themeColor` は維持）。
- `frontend/src/app/globals.css`: 末尾に `html { touch-action: manipulation; }`（理由コメント付き）を追加。

### migration・環境変数・依存追加

- なし。

### 作業順序（コミット単位）

1. **コミット1**: `fix(tsk-129): スマフォの拡大縮小を抑止`
   - `layout.tsx` の `viewport` 更新 + `globals.css` の `touch-action` 追加（1 論理変更のためまとめる）。
   - 完了確認: `pnpm lint` と型チェックが通る／設計書「完了条件（具体化版）」を満たす。

### テスト方針

- 自動テストは対象外（UI 表示設定のみ）。
- `pnpm lint` ＋ 型チェックで機械検証。
- 「手動動作確認シナリオ」を実機/DevTools で確認。

### 想定外時の判断ルール

- **AI 単独判断 OK**: 軽微な既存コードリファクタ、設計書スコープ内の追加実装。
- **中断して要相談**: データモデル変更、API 仕様変更、トランザクション境界変更、外部 API 想定差異、設計判断ログを覆す変更。
- タスク固有: `touch-action` / viewport 設定が design-system の既存グローバルと衝突する場合、または viewport 型が想定プロパティを受け付けない場合は中断して相談。

### 事前解決済みの判断ポイント

- viewport のプロパティ名は Next.js `Viewport` 型準拠の camelCase（`initialScale` / `maximumScale` / `userScalable`）。
- `touch-action` の適用先は `html` 要素（判断 2）。
- 変更は 1 コミットにまとめる。
