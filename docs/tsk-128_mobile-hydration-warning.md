# TSK-128 スマフォでのエラー対応（設計書）

- Notion: <https://app.notion.com/p/3889ca7d99dc806bb8b6e8ca5e04a8af>
- プロジェクト: PRJ（LLM チャット）
- 規模: S / 重要度: HIGH
- 関連: [frontend/src/app/layout.tsx](../frontend/src/app/layout.tsx)（root layout）

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

LOCAL 環境を LAN 内のスマフォ（iPhone Chrome）で開くと、React の hydration mismatch 警告がコンソールに表示される。これを解消する。

エラー要旨:

```text
A tree hydrated but some attributes of the server rendered HTML didn't match
the client properties. ...
  <html lang="ja" className="h-full"
-   __gcrremoteframetoken="b2656a1e4ef4203fdc9b7fa4428e20fc" >
```

### 背景・動機

スマフォでだけエラーが表示され、気持ち悪い。改善したい。

### 完了条件

- スマフォ（iPhone Chrome）でも hydration 警告が出ない状態にする。

### スコープ外

- 他要素（`<body>` 配下の子要素など）での hydration mismatch 対応 — 本件では発生していない。

### 制約

- 実害（表示・動作の不具合）は無く、抑止対象はブラウザ本体が注入する `<html>` 属性差分に限定する（本物の hydration バグを隠さない）。

### 関連資料

- React hydration mismatch: <https://react.dev/link/hydration-mismatch>

### 不明点・迷い

- なし（原因・対処ともに確定）。

## 2. 原因分析

- エラーは `<html>` 要素に、サーバーが描画していない `__gcrremoteframetoken` 属性がクライアント側で付与されていることによる属性不一致（hydration mismatch）。
- 属性名の接頭辞 `gcr` = `__gCrWeb`（Google Chrome Web）は、**Chrome for iOS 本体がページに注入する内部 JavaScript の名前空間**。パスワード管理・オートフィル・フレーム間通信などのためにブラウザ本体が `<html>` に属性を差し込む。
- 当社コード（[frontend/src/app/layout.tsx](../frontend/src/app/layout.tsx)）は当該属性を出力しておらず、**サーバー/アプリのバグではなく環境（ブラウザ）依存の外部干渉**。
- 「スマフォでだけ出る」のは、そのスマフォで Chrome を使っており、Chrome 本体の注入が入るため。iOS Chrome にユーザーが入れられる拡張機能の仕組みは無く、注入の削除・無効化はできない。

## 3. 設計判断ログ

### 判断: 抑止範囲

- **採用: `<html>` にのみ `suppressHydrationWarning` を付与。**
  - 理由: 実際に不一致が起きているのは `<html>` の属性のみ。`suppressHydrationWarning` は付与した要素の**属性に限って**（1 階層のみ）警告を抑止するため、他の本物の hydration バグは従来どおり検知できる。Next.js/React 公式が拡張・第三者による `<html>`/`<body>` 改変に対して推奨する定石。最小変更。
- 却下: `<html>` と `<body>` の両方に付与
  - 理由: `<body>` での不一致は現状発生しておらず、抑止範囲を不必要に広げる。
- 却下: ブラウザ/拡張の無効化で対処
  - 理由: Chrome iOS 本体の挙動であり削除・無効化できない。全ユーザーに依頼するのも非現実的。

## 4. 既存設計との差分

- [frontend/src/app/layout.tsx](../frontend/src/app/layout.tsx) の `<html lang="ja" className="h-full">` に `suppressHydrationWarning` 属性を 1 つ追加するのみ。他ファイル・挙動への影響なし。

## 5. トランザクション境界

- 該当なし（DB・外部副作用を伴わない静的な JSX 属性追加）。

## 6. 完了条件（具体化版）

- [frontend/src/app/layout.tsx](../frontend/src/app/layout.tsx) の root `<html>` に `suppressHydrationWarning` が付与されている。
- `cd frontend && pnpm build`（型チェック含む）が通る。
- iPhone Chrome で LOCAL 環境を開いてもコンソールに当該 hydration 警告が出ない（実機確認）。

## 7. 手動動作確認シナリオ

1. iPhone Chrome で LAN 内の LOCAL 環境（`/chat/new` 等）を開く。
2. ブラウザのコンソール／Next.js dev overlay に hydration mismatch 警告が表示されないことを確認する。
3. 参考: iPhone Safari で開いた場合は元々この警告は出ない（`__gCrWeb` は Chrome 固有）。

## 8. 未確定事項

- なし。

## 9. 実装計画

### 変更・追加ファイル

- 追加: `docs/tsk-128_mobile-hydration-warning.md`（本設計書）
- 変更: `frontend/src/app/layout.tsx`（`<html>` に `suppressHydrationWarning` を追加）

### migration・環境変数・依存追加

- いずれも不要。

### 作業順序（コミット単位）

1. `docs(tsk-128): モバイル hydration 警告の設計書`
   - 完了確認: 本設計書がリポジトリに存在する。
2. `fix(tsk-128): <html> に suppressHydrationWarning を付与`
   - 完了確認: `frontend/src/app/layout.tsx` の `<html>` に属性が付き、`cd frontend && pnpm build` が通る。

### テスト方針

- 自動テストは追加しない（dev 環境・特定ブラウザ依存の警告抑止であり、単体/結合テストで再現・検証できない）。
- `cd frontend && pnpm build`（型チェック）で回帰が無いことを確認。
- 実機（iPhone Chrome）で警告消失を目視確認。

### 想定外時の判断ルール

- AI 単独判断 OK: 設計書スコープ内（`<html>` への属性追加）の微調整。
- 中断して要相談: `<html>` 以外の要素での hydration mismatch が別途見つかった場合、`suppressHydrationWarning` 以外の対処（コード側の SSR/CSR 分岐など）が必要と判明した場合。

### 事前解決済みの判断ポイント

- 抑止範囲は `<html>` のみ（§3 判断ログ）。
- 変更対象は root `layout.tsx` のみ（ネストされた layout は `<html>` を描画しない）。
- ブランチ名: `fix/tsk-128-mobile-hydration-warning`。
