# PRJ-10 T4: スタンドアロン起動の検出・計測

PRJ-10「Petal PWA 化」の 4 番目のタスク。ホーム画面アイコンから起動された
スタンドアロン（インストール済み PWA）と通常のブラウザ起動を区別して検出し、
analytics イベントとして計測する基盤を作る。analytics 送信基盤そのものは未導入のため、
本タスクではイベント発火口（薄い `trackEvent` 抽象）のみを用意し、将来の基盤導入時に
差し替え可能にする。

- Notion プロジェクト: [PRJ-10 Petal PWA 化](https://www.notion.so/36d9ca7d99dc80fe8440fd2ba3cfe077)
- Notion タスク: [スタンドアロン起動の検出・計測](https://www.notion.so/36e9ca7d99dc81aba629c433ade61aea)（TSK-94）
- 前提: [docs/50_pwa-foundation.md](50_pwa-foundation.md)（T1：manifest / SW）、
  [docs/52_install-prompt.md](52_install-prompt.md)（T3：インストール導線）
- 要件参照: [docs/01_requirements.md](01_requirements.md)、PRJ-10 / F-5

## 課題サマリ

`window.matchMedia('(display-mode: standalone)')`（および iOS の
`navigator.standalone`）でアプリの起動モードを判別する小さなフックを作り、
アプリ初回マウント時に **1 回だけ** analytics イベントを発火する。
analytics 送信先は未確定のため、`trackEvent(name, props)` という薄い抽象を
`src/lib/analytics.ts` に置き、現状の実装は `console.info` 出力 + 同名の
`CustomEvent` を `window` に dispatch するだけに留める。
基盤導入時はこの 1 ファイルを差し替えれば良い形にする。

## スコープ

### 対象

- `useDisplayMode` フック（`src/lib/use-display-mode.ts`）
  - 現在の起動モードを `'standalone' | 'browser'` で返す。
  - 判定ロジックは T3 の `InstallPrompt` と同等
    （`matchMedia('(display-mode: standalone)').matches` または
    `navigator.standalone === true`）。
  - 起動モードを判定するだけで、状態変化の監視（`matchMedia` の change イベント）は
    行わない（PWA の起動モードは原則セッション中に変わらないため）。
- `trackEvent` ヘルパー（`src/lib/analytics.ts`）
  - シグネチャ: `trackEvent(name: string, props?: Record<string, string | number | boolean>): void`
  - 現状実装: `console.info('[analytics]', name, props)` + `window.dispatchEvent(new CustomEvent(
    'petal:analytics', { detail: { name, props } }))`。
  - SSR 安全（`typeof window === 'undefined'` ガード）。
- `useStandaloneLaunchTracking` フック（`src/lib/use-standalone-launch-tracking.ts`）
  - アプリのマウント時に 1 回だけ `trackEvent('app_launch', { displayMode })` を発火する。
  - `layout.tsx` 直下の小さなクライアントコンポーネント
    `<StandaloneLaunchTracker />`（`src/components/StandaloneLaunchTracker.tsx`）から
    呼び出す。`InstallPrompt` 等と並べてマウントする。
- iOS PWA の `apple-mobile-web-app-capable` 起動も `display-mode: standalone` または
  `navigator.standalone === true` で拾える前提（T1 で manifest / iOS メタタグは設定済）。

### 対象外

- analytics 基盤そのもの（GA / Vercel Analytics / 自前 backend エンドポイント等）の導入。
  - 送信先は未確定。本タスクではイベント発火口のみとし、基盤導入は別タスクで扱う。
- インストール導線のイベント計測（`beforeinstallprompt` 表示 / dismiss / install 完了等）。
  - T4 のスコープは「起動モードの計測」に限る。T3 / 他タスクで個別に追加する。
- Lighthouse PWA 監査の CI 組み込み（T5）。
- ページビュー / クリック等の汎用イベント計測。

## 制約

- 既存スタック（Next.js 16 + React 19）を維持。
- クライアントシークレット等を含めない（イベント props はユーザー識別子を含めず、
  当面は `displayMode` のみ送る）。
- SSR 中は何もしない（`window` / `navigator` 参照を avoid）。

## 設計判断ログ

### 判断 1: analytics 抽象のレイヤ

- **採用案**: `src/lib/analytics.ts` に `trackEvent(name, props?)` 関数だけを置く。
  現状実装は `console.info` + `window.dispatchEvent(CustomEvent)`。
- **理由**:
  - 既存 analytics 基盤が無く、送信先（GA / Vercel Analytics / 自前 API）も未確定。
  - Notion 完了条件「analytics イベントとして計測できる」を、コード上の発火口の存在で
    満たしつつ、後で 1 ファイル差し替えだけで本物の送信に切り替え可能にする。
  - `CustomEvent` を併発するのは、開発時に DevTools の addEventListener で
    全イベントを観察できるようにするため。テスト / 監視拡張時にも便利。
- **却下案**:
  - 案 X: いきなり GA / Vercel Analytics を導入 — 送信先決定前にコストを払うことになる。
  - 案 Y: backend へ POST — backend / DB 設計が広がり、本タスクのスコープを超える。

### 判断 2: 計測タイミング（毎ナビゲーション or 起動 1 回）

- **採用案**: アプリ初回マウント時に **1 回だけ** `app_launch` を発火する
  （ページ遷移ごとには発火しない）。
- **理由**:
  - Notion の意図は「起動モードの分布計測」。SPA のクライアント遷移を起動回数に含めると
    値が膨らみ、後で base 数を取り違える。
  - SPA でのページビュー計測は別概念であり、analytics 基盤導入時に
    `usePathname` 等で別途設計する。
- **却下案**:
  - 案 X: `usePathname` change で毎回送信 — 上記理由で却下。

### 判断 3: フックのファイル配置

- **採用案**: `src/lib/use-display-mode.ts` / `src/lib/use-standalone-launch-tracking.ts`。
  汎用フックは `src/lib/` 配下に置く（既存の `api-hooks/` と整合）。
- **理由**:
  - ページ固有のフックではないため、`app/**/use-<page>-page.ts` 規約には該当しない。
  - 既存 `src/lib/api-hooks/` と同じレベルに `use-*.ts` を置くのが最小コストで一貫する。
- **却下案**:
  - 案 X: `src/hooks/` ディレクトリを新設 — 既存に無い階層を増やすコストに対し
    フックは 2 個しかないため不要。

### 判断 4: イベント名・props スキーマ

- **採用案**:
  - イベント名: `app_launch`
  - props: `{ displayMode: 'standalone' | 'browser' }`
- **理由**:
  - GA4 等で受ける際の慣例（snake_case + シンプルな props）に合わせる。
  - 起動モード以外のメタ（OS / ブラウザ / バージョン）は送信基盤側で UA から付与する
    のが一般的で、本層で雑多に持ち込まない。
- **却下案**:
  - 案 X: 個別イベント（`launch_standalone` / `launch_browser`） — 集計時に
    一つの `displayMode` ディメンションで切れる方が将来扱いやすい。

## 既存設計との差分・整合性

- T1（PWA 基盤）/ T2（更新通知）/ T3（インストール導線）の構成を変更しない。
- backend / migrations / `.env.example` の変更なし。
- 既存の analytics 関連コードは無い（grep 確認済）。本タスクで初めて
  `src/lib/analytics.ts` を作る。
- `src/components/StandaloneLaunchTracker.tsx` は `'use client'` で `useEffect` を 1 回だけ
  走らせる薄いコンポーネント。`InstallPrompt` / `UpdateNotice` と同じ位置（`SerwistProvider`
  配下）に並べる。

## 完了条件

- [ ] `src/lib/use-display-mode.ts` が `'standalone' | 'browser'` を返すフックを export。
  SSR 安全（初期値は `'browser'`、effect 内で確定）。
- [ ] `src/lib/analytics.ts` が `trackEvent(name, props?)` を export。
  SSR では no-op。クライアントでは `console.info` 出力 + `CustomEvent('petal:analytics')`
  dispatch。
- [ ] `src/lib/use-standalone-launch-tracking.ts` がアプリ初回マウント時に
  `trackEvent('app_launch', { displayMode })` を **1 回だけ** 発火する。
- [ ] `src/components/StandaloneLaunchTracker.tsx`（`'use client'`）が上記フックを使用し、
  `layout.tsx` の `SerwistProvider` 配下にマウントされている。
- [ ] スタンドアロン起動（ホーム画面アイコンから / Desktop Chrome のアプリウィンドウ）で
  `app_launch` が `displayMode: 'standalone'` で発火する。
- [ ] 通常のブラウザタブで開いた場合は `displayMode: 'browser'` で発火する。
- [ ] DevTools コンソールに `[analytics] app_launch { displayMode: ... }` が
  起動につき 1 回だけ出る（ページ遷移では再発火しない）。
- [ ] `cd frontend && pnpm lint && pnpm build` が通る（型エラーなし）。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

1. `cd frontend && pnpm build && pnpm start:prod` で本番ビルドを起動。
2. Chrome 通常タブで `/` を開く → DevTools コンソールに
   `[analytics] app_launch { displayMode: 'browser' }` が **1 回** 出る。
3. SPA で別ページ（例: `/images`）に遷移 → 追加の `app_launch` が **発火しない** ことを確認。
4. PC Chrome でアプリをインストール → アプリウィンドウから起動 → コンソールに
   `[analytics] app_launch { displayMode: 'standalone' }` が出ることを確認。
5. iPhone Safari でホーム画面に追加し、ホーム画面アイコンから起動 → リモートデバッグで
   同じく `displayMode: 'standalone'` が確認できる。
6. DevTools の Console で
   `addEventListener('petal:analytics', e => console.log(e.detail))` を仕込み、
   リロードすると `CustomEvent` 経由でも同じイベントが観測できる。

## 実装計画

### 変更・追加ファイル

- frontend/
  - `src/lib/analytics.ts`（新規）
  - `src/lib/use-display-mode.ts`（新規）
  - `src/lib/use-standalone-launch-tracking.ts`（新規）
  - `src/components/StandaloneLaunchTracker.tsx`（新規）
  - `src/app/layout.tsx`（`<StandaloneLaunchTracker />` を追加）
- docs/
  - `53_standalone-detection.md`（本書）
  - `AGENTS.md` ドキュメント表に追記

### 必要な migration / 環境変数 / 依存追加

- 不要。

### 作業順序（コミット単位）

1. **コミット 1**: 設計ドキュメント追加（本書 + AGENTS.md）。
2. **コミット 2**: `analytics.ts` / `use-display-mode.ts` / `use-standalone-launch-tracking.ts` /
   `StandaloneLaunchTracker.tsx` 実装 + `layout.tsx` マウント。

### テスト方針

- 自動テスト: 書かない。`matchMedia` / `navigator.standalone` / `display-mode` は実機
  ブラウザ挙動が本質で、jsdom でのモックは検証価値が低い。手動動作確認シナリオで担保。

### 想定外時の判断ルール

- AI 単独判断 OK: 型・import 整理、フックの内部実装方法の微調整、`CustomEvent` の
  detail 構造の調整。
- 中断して相談: analytics 送信先を決める必要が出てきた / 起動モード判定が iOS で
  期待通り取れない、等。

### 事前解決済みの判断ポイント

- Q: 送信先は？ → A: 当面は `console.info` + `CustomEvent` のみ（判断 1）。
- Q: 計測タイミングは？ → A: アプリ初回マウント時 1 回（判断 2）。
- Q: イベント名・props は？ → A: `app_launch` / `{ displayMode }`（判断 4）。
