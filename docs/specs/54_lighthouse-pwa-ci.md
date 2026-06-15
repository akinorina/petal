# Lighthouse PWA 監査の CI 組み込み（TSK-95 / PRJ-10 T5）

PRJ-10「Petal PWA 化」の仕上げタスク。Lighthouse の PWA installability 監査を GitHub Actions
の CI に組み込み、manifest・アイコン・SW 設定崩れによる installable 判定の回帰を自動検知する。

- Notion タスク: [Lighthouse PWA 監査の CI 組み込み](https://www.notion.so/36e9ca7d99dc8115a65ede3b0a890037)
- 要件参照: [docs/01_requirements.md](01_requirements.md) PRJ-10 非機能要件「Lighthouse PWA 監査」
- 既存 CI 設計: [docs/40_github-actions-ci.md](40_github-actions-ci.md)
- PWA 基盤: [docs/50_pwa-foundation.md](50_pwa-foundation.md)

## 課題サマリ

`installable` 判定（manifest・アイコン・start_url 等）の回帰を CI で自動検知する。Lighthouse CI
（`@lhci/cli`）を用いて本番ビルド済みのフロントエンドに対し `installable-manifest` 監査を実行
し、スコア 1 未満で CI を失敗させる。

## スコープ

### 対象

- `.github/workflows/ci.yml` に新規ジョブ `lighthouse` を追加。
- `frontend/lighthouserc.json` を新設し、`@lhci/cli` の collect / assert 設定を定義する。
- 監査対象: `installable-manifest`（必須・スコア 1 でなければ fail）。
  補助的に `apple-touch-icon` / `maskable-icon` / `viewport` も warn で計測する。
- 起動方式: `pnpm build` 済みの `next start --port 4321` を Lighthouse CI の `startServerCommand`
  で立ち上げ、`http://localhost:4321/login` を計測。ローカルでの port 3000 衝突（backend 既存
  プロセス）と CI の意図しない競合を避けるため専用ポートを使用する。
- `frontend/package.json` に `@lhci/cli@0.13.0` を devDependency として追加（Lighthouse 11.4 を
  内包）。

### 非対象

- パフォーマンス / アクセシビリティ / Best Practices / SEO のスコア閾値。完了条件にも明記の通り
  PWA installability のみをゲートする。
- Lighthouse CI Server（成績蓄積用サーバ）の構築・履歴アップロード。`assert` のみ使用し、CI の
  pass/fail で完結する。
- E2E 用の backend 連携（Cognito / DB）は不要。Lighthouse は静的に配信される manifest・SW・
  アイコンを評価するため、認証前のページ（`/login`）で計測する。
- CD（デプロイ後 Lighthouse 監査）への組み込み。CI（PR / main push）のみ。

## 関連ドキュメント

- [docs/40_github-actions-ci.md](40_github-actions-ci.md) … 既存 CI 構造（backend / frontend ジョブ）。
- [docs/50_pwa-foundation.md](50_pwa-foundation.md) … manifest / SW / アイコンの実体。
- [docs/52_install-prompt.md](52_install-prompt.md) … インストール導線（Lighthouse は前提条件である
  installable 判定のみを担保し、UI の表示自体は監査しない）。

## 設計判断

### 判断 1: ツール選定（`@lhci/cli@0.13` 採用）

- **採用案**: `@lhci/cli@0.13.0`（内部で Lighthouse 11.4 を使用）を `frontend/` の devDependency
  として追加し、`lhci autorun` を CI で実行する。設定は `frontend/lighthouserc.json`。
- **理由**:
  - GitHub Actions 上で公式に推奨されている方式。`startServerCommand` で `next start` をライフ
    サイクル管理付きで起動でき、ジョブの自前 background プロセス管理が不要。
  - JSON 設定で `assertions` を宣言的に書けるため、対象監査の追加削除が容易（将来 perf / a11y を
    足す場合も同じ仕組み）。
  - `treosh/lighthouse-ci-action` のようなサードパーティ Action でなく公式 CLI を直接使うことで、
    依存元を 1 つに絞り（npm 上の `@lhci/cli`）、Action のバージョン追従コストを避ける。
  - **Lighthouse 12 系で `installable-manifest` / `maskable-icon` 等 PWA 関連監査が削除された**
    ため、最新の `@lhci/cli@0.15`（Lighthouse 12.6）/`0.14`（Lighthouse 12.1）は本タスクの要件
    （installable 判定のゲート）を満たせない。Lighthouse 11.x をバンドルする最後のメジャーで
    ある `@lhci/cli@0.13.0` を採用する。
- **却下案**:
  - 案 X: `lighthouse` CLI を素で実行 + 自前 jq でスコア判定 — 起動・終了制御・JSON 解釈をすべて
    シェルで組む必要があり保守性が低い。却下。
  - 案 Y: `treosh/lighthouse-ci-action@v12` — 内部で `@lhci/cli` を呼ぶラッパー。pin する Action
    バージョンと内部 lhci バージョンの二重管理になるため却下。

### 判断 2: 監査対象 URL（`/login`）

- **採用案**: `http://localhost:3000/login` を計測対象にする。
- **理由**:
  - Petal はクライアントサイド認証で、`/` は `(authenticated)` レイアウトの認証ガードによりログイン
    ページへリダイレクトされる。Lighthouse が初期ロードでリダイレクト先を計測しても結果は同じ
    だが、明示的に `/login` を指定して挙動を安定化させる。
  - `manifest.webmanifest` と `sw.js` は全ページ共通で配信されるため、installable 監査の結果は
    URL に依らない。認証不要のページを選ぶことで Cognito / backend モックを CI に持ち込まずに
    済む（[docs/40 §4.2](40_github-actions-ci.md) の frontend ジョブと同様、外部依存ゼロ）。
- **却下案**:
  - 案 X: `/` を計測 — リダイレクトされるためログ上の解釈がブレやすい。却下。

### 判断 3: 監査範囲（`installable-manifest` のみゲート）

- **採用案**: 厳格にゲートするのは `installable-manifest` のみ（`["error", { "minScore": 1 }]`）。
  補助として `maskable-icon` / `viewport` を warn 相当でレポートする。
- **理由**:
  - 完了条件は「installable 判定が出ないと CI が落ちる」であり、`installable-manifest` 監査の
    スコア 1 がそれに直接対応する（manifest・start_url・icons・display を Chrome が installable
    と判断したかを 1/0 で返す）。
  - Lighthouse 11 では PWA カテゴリは存在するが、本タスクの要件は PWA 全体スコアではなく
    installability のみのため、`onlyAudits` で対象監査を絞って実行コストを抑える。
  - maskable-icon は Android のホーム画面体験に直結するが、欠落しても Chrome の installability
    自体は通るため、本タスクのゲートとしては warn に留める。`apple-touch-icon` 監査は
    Lighthouse 11 では individual audit として公開されておらず、`installable-manifest` 側で
    iOS 用 fallback として `apple-touch-icon` の存在を含めて評価される。
- **却下案**:
  - 案 X: `categories:pwa` を assert — Lighthouse 12 で PWA カテゴリは存在しない。却下。
  - 案 Y: `service-worker` 監査を必須にする — Lighthouse 12 で同名監査は deprecated。`installable
    -manifest` が SW を含めた installable 全体を Chrome 基準で判断するためそちらに委ねる。

### 判断 4: ジョブの独立化（既存 frontend ジョブと分離）

- **採用案**: 既存 `frontend` ジョブとは別に `lighthouse` ジョブを新設し、並列実行する。
- **理由**:
  - Lighthouse 実行は Chrome headless の起動・Lighthouse 本体・SW 評価で 1〜2 分かかる。lint /
    build を含む `frontend` ジョブに直列で足すと PR の feedback time が伸びる。
  - 失敗時の切り分けが楽（lint 起因なのか PWA 退行なのか CI のジョブ名から即判断できる）。
  - `lighthouse` ジョブも `pnpm build` を独立に実行するため重複コストはあるが、`actions/setup-node`
    の `cache: pnpm` でモジュール取得は共有され、ビルド時間も Next 16 で 1 分未満。許容。
- **却下案**:
  - 案 X: 既存 `frontend` ジョブに `pnpm lhci autorun` を追加 — feedback time 悪化と失敗原因切り
    分けの煩雑化のため却下。

### 判断 5: SW 登録タイミング

- Serwist は `SerwistProvider` 経由でクライアント側で `register()` する。Lighthouse の
  `installable-manifest` 監査自体は SW を必須としない（Chrome の installability 緩和後の仕様）
  ため、SW 未登録でも当監査は pass しうる。本タスクのゲートは installable のみなので追加対応は
  不要。SW 配信を含めた挙動確認は [docs/50 §「手動動作確認シナリオ」](50_pwa-foundation.md) で
  担保済み。

## トランザクション境界

DB / 外部 API への副作用なし。本タスクは CI 構成のみで完結する。

## 既存設計との差分・整合性

- `.github/workflows/ci.yml` に `lighthouse` ジョブを追加する。既存 `backend` / `frontend` ジョブ
  には変更を加えない（[docs/40](40_github-actions-ci.md) の構造をそのまま拡張）。
- `frontend/package.json` の devDependencies に `@lhci/cli` を追加（dev のみ）。ランタイム依存に
  影響しない。
- migration / 環境変数 / `.env.example` の更新は不要。
- Amplify ビルド（[docs/37](37_amplify-hosting-setup.md)）への影響なし。`@lhci/cli` は dev のみ
  なので `pnpm install --prod` 時には入らず本番バンドル肥大化もしない。

## 完了条件

- [ ] `frontend/package.json` に `@lhci/cli@0.13.0` が devDependency として追加されている。
- [ ] `frontend/lighthouserc.json` が存在し、`installable-manifest` を error 閾値でアサート
      している。
- [ ] `.github/workflows/ci.yml` に `lighthouse` ジョブが追加され、`pull_request` / `push (main)`
      で自動起動する。
- [ ] PR で manifest / アイコンを意図的に壊した場合に `lighthouse` ジョブが fail する（手動確認）。
- [ ] 正常な main ブランチでは `lighthouse` ジョブが緑になる。
- [ ] `cd frontend && pnpm install --frozen-lockfile` が成功する（lockfile を更新済み）。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

1. ローカルで `cd frontend && pnpm install && pnpm build && pnpm exec lhci autorun` を実行し、
   `installable-manifest` が pass することを確認。
2. PR を作成し、GitHub Actions の Checks タブに `lighthouse` ジョブが表示され、緑になることを
   確認。
3. ローカルで `frontend/src/app/manifest.ts` の `icons` 配列を空にして `pnpm build && pnpm exec
   lhci autorun` を実行 → `installable-manifest` が fail し、CI 相当の戻り値が非 0 になる
   ことを確認（変更は revert）。
4. `lighthouse` ジョブの実行ログに `installable-manifest` のスコアが出力されている。

## 想定外時の判断ルール

- AI 単独判断 OK: lhci の設定キー名差異への追従、CI ジョブ steps の整理、Chrome headless 起動
  オプションの微調整。
- 中断して相談: 完了条件「installable 判定が出ないと CI が落ちる」を満たすために `installable
  -manifest` 以外の監査も必須化する必要が出た場合、または本番ビルドで installable が落ちる
  根本問題が発覚した場合。

## 実装計画概要（詳細は Step 2 で具体化）

### 変更・追加ファイル

- `.github/workflows/ci.yml`（既存）に `lighthouse` ジョブ追加。
- `frontend/lighthouserc.json`（新規）。
- `frontend/package.json` / `frontend/pnpm-lock.yaml`（`@lhci/cli` 追加）。
- `docs/54_lighthouse-pwa-ci.md`（本書）。
- [AGENTS.md](../AGENTS.md) ドキュメント表へ追記。

### 想定外時の対応

- Lighthouse が headless Chrome を起動できない CI 環境エラーが出た場合、`puppeteer` 等の Chrome
  バンドルを追加するのではなく、`ubuntu-latest` ランナーにプリインストールされている Chrome を
  `lhci` の `chromePath` で明示するか、`--collect.settings.chromeFlags="--no-sandbox"` で逃がす。
