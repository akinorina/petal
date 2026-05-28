# PRJ-10 T1: PWA 基盤 + キャッシュ戦略の導入

PRJ-10「Petal PWA 化」の最初のタスク。Service Worker・Web App Manifest・アイコン・iOS
メタタグ・Workbox キャッシュ戦略を導入し、installable な PWA 基盤を整える。本実装は今後
他アプリでも再利用する GitHub テンプレートの土台となる。

- Notion プロジェクト: [PRJ-10 Petal PWA 化](https://www.notion.so/36d9ca7d99dc80fe8440fd2ba3cfe077)
- Notion タスク: [PWA 基盤 + キャッシュ戦略の導入](https://www.notion.so/36e9ca7d99dc81a79f9ae5c139c06abd)
- 要件参照: [docs/01_requirements.md](01_requirements.md)、PRJ-10 の F-1 / F-2

## 課題サマリ

`@serwist/next` を導入し、Web App Manifest・アイコン・iOS メタタグ・Workbox キャッシュ戦略
（precache / 画像 CacheFirst / backend API は NetworkOnly）まで含めて installable な PWA
基盤を整える。SW 更新通知 UI・インストール導線・スタンドアロン計測・Lighthouse CI は後続
タスク（T2〜T5）に分離する。

## スコープ

### 対象

- `@serwist/next` の導入と `next.config.ts` 設定（dev は SW 無効）。
- `src/app/manifest.ts`（Next.js Metadata API）による Web App Manifest 生成。
- PWA アイコン（192 / 512 + maskable）と apple-touch-icon の生成・配置。
- iOS 向け `<head>` メタタグ（`apple-mobile-web-app-*`）を `layout.tsx` に追加。
- Service Worker（`src/app/sw.ts`）のキャッシュ戦略実装:
  - アプリシェル（`_next/static` / フォント等）の precache。
  - 静的画像アセットの runtime CacheFirst。
  - **backend API（別オリジン）の NetworkOnly**。
  - SW 更新時の `skipWaiting` / `clientsClaim` による即時適用。
- オフライン時の navigation フォールバックページ（`/~offline`）。

### 対象外

- SW 更新通知 UI（T2）。
- インストール導線（Android プロンプト + iOS 案内モーダル）（T3）。
- スタンドアロン起動の検出・計測（T4）。
- Lighthouse PWA 監査の CI 組み込み（T5）。
- IndexedDB 退避・Background Sync・Push 通知（後続 PRJ）。

## 制約

- 既存スタック（Next.js 16 + React 19）を維持。Amplify SSR デプロイ構成
  （[docs/37](37_amplify-hosting-setup.md)）を壊さない。
- HMR を損なわないよう、開発時（`NODE_ENV === 'development'`）は SW を無効化する。
- pnpm のみ。`cd frontend && pnpm install` で依存追加（workspace は組まない）。
- クライアントシークレット等の秘密情報を SW・manifest・フロントに混入させない。

## 設計判断ログ

### 判断 1: PWA ライブラリの選定

- **採用案**: `@serwist/next`（v9.5.11）+ `serwist`（dev 依存）。
- **理由**:
  - Notion 仕様の `@ducanh2912/next-pwa` は v10.2.9（約 2 年前）が最終で実質メンテ停止、
    Next.js 16 対応が未確認。npm ページ自身が後継の `@serwist/next` への移行を推奨している。
  - Serwist は同作者による Workbox フォークで、App Router・TypeScript・Next 16 で活発に
    メンテされている（peer: `next>=14` `react>=18` `typescript>=5`）。
  - 本 PRJ は GitHub テンプレートとして他アプリでも再利用する目的があり、将来性を優先すべき。
  - `app/sw.ts` に SW を記述でき、precache / runtimeCaching / skipWaiting / clientsClaim /
    NetworkOnly を明示的に制御できる（キャッシュ境界をコードで担保しやすい）。
- **却下案**:
  - 案 X: `@ducanh2912/next-pwa` を仕様通り採用 — Next 16 動作保証なし・メンテ停止リスク。
    テンプレート化方針と矛盾するため却下。
  - 案 Y: ライブラリなしの手動 SW — Workbox precache のビルド時生成を自前実装する工数が大きく、
    テンプレートとしての保守性も劣るため却下。

### 判断 2: キャッシュ境界（機密データの扱い）

- **採用案**: backend API（別オリジン）を **NetworkOnly** とし、ページシェルは NetworkFirst。
- **理由**:
  - Petal は**クライアントサイド認証**で、`(admin)` レイアウトが `isAuthenticated` で描画を
    ゲートする。ページ HTML 自体はユーザーデータを含まず、機密データは別オリジンの backend API
    （`NEXT_PUBLIC_API_BASE_URL`）レスポンスにのみ存在する。
  - したがって機密漏れ防止の本質は「API レスポンスをキャッシュしないこと」。API オリジンへの
    リクエストを NetworkOnly にすれば、他ユーザーへの漏洩も古いデータの表示も起こらない。
  - ページシェルは機密でないため、NetworkFirst でオフライン閲覧を可能にしてオフライン耐性を
    確保する（Notion 受け入れ条件「既に表示したページが閲覧できる」を満たす）。
- **却下案**:
  - 案 X: 認証ページ（`(admin)` 配下）も NetworkOnly — Notion の字義通りだが、サーバレンダ前提の
    表現。クライアント認証の実態では HTML は機密でなく、オフライン耐性を不必要に損なうため却下。

### 判断 3: アイコン素材

- **採用案**: 純 Node スクリプト（`frontend/scripts/generate-pwa-icons.mjs`、依存ゼロ・zlib で
  PNG エンコード）で、ブランドカラー（coral `#D9624A`）背景に花弁モチーフを描いて
  192 / 512 / maskable 各サイズと apple-touch-icon を生成し `public/icons/` に配置する。
- **理由**:
  - 専用ロゴが存在せず（素材は低解像度の `favicon.ico` のみ）、512px に耐える素材が必要。
  - `sharp` 等の画像ライブラリ・ImageMagick が未導入で、新規ランタイム依存を増やしたくない。
  - 純 Node + zlib なら追加依存ゼロで生成でき、生成物（PNG）を静的アセットとしてコミットすれば
    precache でき再現性も保てる。ロゴ確定後はスクリプト再実行 or 画像差し替えで更新可能。
- **却下案**:
  - 案 X: favicon から流用 — 解像度不足で 512px maskable に耐えないため却下。
  - 案 Y: `sharp` 導入 — 一度きりのアセット生成のために重いネイティブ依存を増やすため却下。

## Web App Manifest 仕様（`src/app/manifest.ts`）

| 項目 | 値 |
| --- | --- |
| `name` | `Petal` |
| `short_name` | `Petal` |
| `description` | `Petal 画像コンテンツ管理` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | `#D9624A`（coral-500） |
| `background_color` | `#FBFAF7`（neutral-50） |
| `icons` | `icon-192.png` / `icon-512.png`（purpose `any`）、`icon-maskable-192.png` / `icon-maskable-512.png`（purpose `maskable`） |

iOS 向けには `layout.tsx` の `metadata.appleWebApp`（`capable: true` /
`statusBarStyle: 'default'` / `title: 'Petal'`）と `apple-touch-icon`、`viewport.themeColor`
を設定する。

## キャッシュ戦略（`src/app/sw.ts`）

| 対象 | 戦略 |
| --- | --- |
| アプリシェル（`_next/static`、JS / CSS / フォント） | precache（`self.__SW_MANIFEST`、ビルド時自動生成） |
| Next のページ navigation | NetworkFirst（`@serwist/next/worker` の `defaultCache`）。オフライン時は `/~offline` フォールバック |
| 静的画像アセット | CacheFirst（`defaultCache` の画像エントリ） |
| **backend API（`NEXT_PUBLIC_API_BASE_URL` のオリジン）** | **NetworkOnly**（`defaultCache` より前に明示ルートを登録しキャッシュ禁止） |

- SW は `skipWaiting: true` / `clientsClaim: true` で更新を即時適用する（T2 で承認 UI を被せる）。
- API オリジン判定は SW バンドルにインライン化される `process.env.NEXT_PUBLIC_API_BASE_URL`
  から導出する。未設定時（ローカル）は同一オリジンの `/` をデフォルトとし、相対 API も想定し
  パス `^/(auth|users|images|audit-logs)` も NetworkOnly に含める。

## 既存設計との差分・整合性

- フロントエンドのみの変更。backend / migrations / `.env.example` の変更は不要
  （`NEXT_PUBLIC_API_BASE_URL` は既存）。
- Amplify ビルド（[docs/37](37_amplify-hosting-setup.md)）は `pnpm build` → `.next` を成果物に
  する。Serwist はビルド時に `public/sw.js` を生成するため、`.next` 配下の静的配信に含まれる。
  追加のビルド手順変更は不要。
- `next.config.ts` の既存設定（`allowedDevOrigins`）は `withSerwist(...)` でラップして温存する。

## 完了条件（具体化版）

- [ ] `@serwist/next` / `serwist` が `frontend/package.json` に追加され `pnpm install` 済み。
- [ ] `next.config.ts` が `withSerwistInit`（`swSrc: 'src/app/sw.ts'` / `swDest: 'public/sw.js'`
      / dev 無効化）でラップされている。
- [ ] `src/app/manifest.ts` が上記仕様の manifest を返す。
- [ ] `public/icons/` に 192 / 512 / maskable / apple-touch-icon が配置されている。
- [ ] `layout.tsx` に iOS メタタグ（`appleWebApp` / `apple-touch-icon` / `themeColor`）が入る。
- [ ] `src/app/sw.ts` が precache + 画像 CacheFirst + backend API NetworkOnly + skipWaiting +
      clientsClaim を実装している。
- [ ] `/~offline` フォールバックページが存在し、オフライン時の navigation で表示される。
- [ ] 回線オフラインで、既に表示したページ・アセットが閲覧できる。
- [ ] backend API レスポンスがキャッシュされない（NetworkOnly が効く）。
- [ ] `cd frontend && pnpm build` / `pnpm lint` が通り、`tsc` 型エラーがない。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

1. `cd frontend && pnpm build && pnpm start:prod` で本番ビルドを起動する。
2. Chrome DevTools → Application → Manifest で manifest が読み込まれ、アイコンが表示される。
3. Application → Service Workers で SW が `activated` になっている。
4. Lighthouse → PWA 監査で **installable 判定**が出る。
5. ネットワークを Offline にし、既に開いた `/images` をリロード → ページシェルが表示される。
6. オフラインで未訪問ページへ遷移 → `/~offline` フォールバックが表示される。
7. オンラインに戻し、Network タブで backend API（`NEXT_PUBLIC_API_BASE_URL`）へのリクエストが
   `from ServiceWorker` ではなくネットワークから取得されている（NetworkOnly）。
8. Application → Cache Storage に API レスポンスが**入っていない**ことを確認。
9. macOS / Windows Chrome で installable（アドレスバーのインストールアイコン）を確認。

## 未確定事項 / リスク

- Serwist の `defaultCache` がデフォルトでクロスオリジンをどう扱うかに依存するため、NetworkOnly
  ルートを `defaultCache` より**前**に登録して確実に優先させる（実装時に Cache Storage を実機確認）。
- Amplify Hosting が `public/sw.js` を `Service-Worker-Allowed` 等のヘッダ込みで正しく配信するか
  は実機デプロイで確認が必要（ローカル本番ビルドでの確認を先行）。
- 花弁モチーフアイコンはプレースホルダ。正式ロゴ確定後に差し替える。

## 実装計画

### 変更・追加ファイル

- frontend/
  - `package.json` / `pnpm-lock.yaml`（`@serwist/next` + `serwist` 追加）
  - `next.config.ts`（`withSerwistInit` ラップ）
  - `tsconfig.json`（`types: ['@serwist/next/typings']` / `lib: ['webworker']` 追記、
    `public/sw.js` を exclude）
  - `src/app/sw.ts`（新規・Service Worker 本体）
  - `src/app/manifest.ts`（新規・Web App Manifest）
  - `src/app/layout.tsx`（iOS メタタグ・themeColor 追加）
  - `src/app/~offline/page.tsx`（新規・オフラインフォールバック）
  - `public/icons/*`（新規・生成アイコン）
  - `scripts/generate-pwa-icons.mjs`（新規・アイコン生成スクリプト）
  - `.gitignore`（`public/sw.js` と Serwist 生成物を無視）
- docs/
  - `50_pwa-foundation.md`（本書）
  - `AGENTS.md` ドキュメント表に追記

### 必要な migration / 環境変数 / 依存追加

- migration: 不要
- 環境変数: 追加なし（`NEXT_PUBLIC_API_BASE_URL` は既存）
- 依存パッケージ: `@serwist/next`（dependencies）/ `serwist`（devDependencies）を追加

### 作業順序（コミット単位）

1. **コミット 1: 設計ドキュメント追加**
   - 含めるファイル: `docs/50_pwa-foundation.md`、`AGENTS.md`
   - 完了確認: `npx markdownlint-cli 'docs/**/*.md'`
2. **コミット 2: Serwist 導入と SW・manifest 実装**
   - 含めるファイル: `package.json` / `pnpm-lock.yaml` / `next.config.ts` / `tsconfig.json` /
     `src/app/sw.ts` / `src/app/manifest.ts` / `src/app/layout.tsx` / `src/app/~offline/page.tsx`
     / `.gitignore`
   - 完了確認: `cd frontend && pnpm lint && pnpm build`、本番起動で SW 登録・manifest 読込
3. **コミット 3: PWA アイコン生成・配置**
   - 含めるファイル: `scripts/generate-pwa-icons.mjs` / `public/icons/*`
   - 完了確認: DevTools Manifest でアイコン表示、Lighthouse installable 判定

### テスト方針

- 自動テスト: 書かない。SW・manifest・アイコンはブラウザ実機挙動が本質で、ユニットテストの費用
  対効果が低い。検証は上記「手動動作確認シナリオ」と Lighthouse（T5 で CI 化）で担保する。

### 想定外時の判断ルール

- AI 単独判断 OK: Serwist の API 形状差異への追従、型・import 整理、`defaultCache` の構成微調整。
- 中断して相談: manifest の必須項目を満たせず installable にならない / Amplify で `sw.js` が配信
  されない / NetworkOnly が `defaultCache` で上書きされ API がキャッシュされてしまう、等の設計を
  揺るがす事象。

### 事前解決済みの判断ポイント

- Q: ライブラリは？ → A: `@serwist/next`（判断 1）。
- Q: キャッシュ境界は？ → A: backend API のみ NetworkOnly、ページシェルは NetworkFirst（判断 2）。
- Q: アイコン素材は？ → A: 純 Node スクリプトで花弁モチーフを生成（判断 3）。
- Q: manifest の theme/background は？ → A: `#D9624A` / `#FBFAF7`。
- Q: 配置先は `src/app/`？ → A: 本プロジェクトは `src/app/` 配置のため `swSrc: 'src/app/sw.ts'`。
