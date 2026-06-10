# PRJ-10 T2: SW 更新通知 UI

PRJ-10「Petal PWA 化」の 2 番目のタスク。新しい Service Worker が `waiting` 状態に入った
ことをユーザーに通知し、承認したら即時に新バージョンへ切り替える UI を実装する。

- Notion プロジェクト: [PRJ-10 Petal PWA 化](https://www.notion.so/36d9ca7d99dc80fe8440fd2ba3cfe077)
- Notion タスク: [SW 更新通知 UI](https://www.notion.so/36e9ca7d99dc81a88b0ac604b9d3e1e0)
- 前提: [docs/50_pwa-foundation.md](50_pwa-foundation.md)（T1 で SW 登録 + `SerwistProvider` を導入済み）

## 課題サマリ

T1 で `skipWaiting: true` / `clientsClaim: true` により新 SW は自動的に有効化される設定だが、
**現在ページが旧 SW にコントロールされている間は新リソースが反映されない**ため、ユーザーに
明示的なリロード機会を提供する。`@serwist/window` の `Serwist` クラスから `waiting` イベントを
受け、画面下部のバナーで「アップデートがあります。再読み込みしますか？」と表示する。

## スコープ

### 対象

- `UpdateNotice` クライアントコンポーネント実装（`src/components/UpdateNotice.tsx`）。
- `layout.tsx` の `SerwistProvider` 配下に `UpdateNotice` を配置。
- 「再読み込み」「あとで」の 2 アクション。
- 「あとで」は **セッションメモリでのみ抑制**（localStorage 永続化はしない）。

### 対象外

- design-system Toast / ToastProvider の全体導入（本タスクの範囲を超える）。
- analytics への更新検知イベント送出。
- 強制更新ポリシー（古いバージョンを使い続けるユーザーへの対応）。

## 設計判断ログ

### 判断 1: UI 形式（トースト vs 専用バナー）

- **採用案**: `src/components/UpdateNotice.tsx` の **画面下部固定バナー**（自前・design-system
  トークンを使用）。
- **理由**:
  - 現状アプリで `ToastProvider` が未導入であり、本タスクのために導入するのは範囲超過。
  - 「アップデートあり → リロード」は sticky な確認 UI が望ましく、自動消失するトーストよりも
    バナーが UX 上適切。design-system トークン（`bg-surface-raised` / `text-text-primary`
    / `bg-accent-default` 等）でビジュアル整合性は確保できる。
- **却下案**:
  - 案 X: design-system Toast を `ToastProvider` 導入とともに使用 — 範囲超過。将来的に他通知が
    増えたら別タスクで ToastProvider 導入の検討を行う。

### 判断 2: 「あとで」の抑制範囲

- **採用案**: **セッションメモリ（コンポーネント state）のみ**で抑制。次の `waiting` 再発火
  または手動リロードで再表示される。
- **理由**:
  - localStorage 永続抑制は「更新を永久に拒否」する経路を生み、PWA の SW 更新フローの根幹を
    弱める。Petal はクライアント認証のアプリで、古いコードを使い続けるリスク（API 互換、UI 破綻）
    がある。再表示の煩わしさより安全性を優先。
- **却下案**:
  - 案 X: localStorage で SW バージョン単位の抑制 — 利便性は上がるが上記リスクのため却下。

### 判断 3: リロードタイミング

- **採用案**: `serwist.addEventListener('controlling', ...)` を 1 回だけ受けてから
  `location.reload()`。`messageSkipWaiting()` を呼び、新 SW が controlling になったことを確認
  してからリロードする。
- **理由**:
  - `messageSkipWaiting()` 直後にリロードすると、まだ新 SW が controlling していないタイミングで
    再フェッチが走り、旧 SW のキャッシュから応答される可能性がある。`controlling` を待つことで
    確実に新リソースが供給される。

## シーケンス

```text
新バージョンのデプロイ
   │
   ▼
ブラウザが /sw.js を取得 → 新 SW がインストールされ waiting 状態へ
   │
   ▼
@serwist/window が "waiting" イベントを発火
   │
   ▼
UpdateNotice が state を立て、画面下部にバナー表示
   │
   ├─[ユーザーが「再読み込み」]
   │        │
   │        ▼
   │   "controlling" イベントの 1 回限りリスナを登録
   │        │
   │        ▼
   │   serwist.messageSkipWaiting()  → 新 SW が activated → controlling
   │        │
   │        ▼
   │   location.reload() で新リソースを取得
   │
   └─[ユーザーが「あとで」]
            │
            ▼
       state でバナーを非表示（セッション中は再表示しない）
```

## 既存設計との差分・整合性

- T1 で導入した `SerwistProvider`（`@serwist/next/react`）の `useSerwist()` フックを利用する。
  `serwist` インスタンスは `disable={process.env.NODE_ENV !== 'production'}` のため dev では
  `null` になり、`UpdateNotice` は何もせず終了する（dev で意図しない表示が出ない）。
- backend / migrations / `.env.example` の変更なし。

## 完了条件

- [ ] 新 SW が waiting 状態になったときに画面下部にバナーが表示される。
- [ ] 「再読み込み」で新 SW が controlling になり、ページが最新リソースで再描画される。
- [ ] 「あとで」でバナーが閉じ、セッション中は再表示されない。
- [ ] dev 環境でバナーが表示されない（SW 自体が無効のため）。
- [ ] 既存 UI にデグレなし。
- [ ] `cd frontend && pnpm lint && pnpm build` が通る。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

1. `cd frontend && pnpm build && pnpm start:prod` で本番ビルドを起動 → トップを開く。
2. DevTools → Application → Service Workers で SW が `activated`。バナー非表示。
3. ソース変更（任意の `.tsx` を 1 行編集）→ 再ビルド → `serwist build serwist.config.ts` 後、
   ブラウザをリロード。
4. DevTools → Application で新 SW が `waiting` になり、**画面下部に更新バナーが表示される**。
5. 「あとで」を押下 → バナーが消える。同セッション内で（手動リロードしない限り）再表示されない。
6. 再度同じ手順で waiting を再現 → 今度は「再読み込み」を押下 → 新 SW が `activated and is
   running`、ページが新版で再描画される。

## 実装計画

### 変更・追加ファイル

- frontend/
  - `src/components/UpdateNotice.tsx`（新規・本コンポーネント）
  - `src/app/layout.tsx`（`UpdateNotice` をマウント）
- docs/
  - `51_sw-update-notice.md`（本書）
  - `AGENTS.md` ドキュメント表に追記

### 必要な migration / 環境変数 / 依存追加

- 不要。

### 作業順序（コミット単位）

1. **コミット 1**: 設計ドキュメント追加（本書 + AGENTS）。
2. **コミット 2**: `UpdateNotice` 実装 + `layout.tsx` マウント。

### テスト方針

- 自動テスト: 書かない（SW lifecycle はブラウザ実機挙動が本質）。手動動作確認シナリオで担保。

### 想定外時の判断ルール

- AI 単独判断 OK: 既存 design-system トークン適用の微調整、`useSerwist` 戻り値型への追従。
- 中断して相談: `@serwist/window` の `waiting`/`controlling` イベント API が想定と異なる場合、
  または「あとで」抑制の永続化要望が出た場合。

### 事前解決済みの判断ポイント

- Q: UI 形式は？ → A: 自前バナー（判断 1）。
- Q: 「あとで」永続化？ → A: しない、セッションメモリのみ（判断 2）。
- Q: リロードのタイミングは？ → A: `controlling` イベント待ち（判断 3）。
- Q: dev での挙動は？ → A: `serwist === null` で何もしない。
