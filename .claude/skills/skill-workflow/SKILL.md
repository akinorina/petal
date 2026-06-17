---
name: skill-workflow
description: Petal リポジトリでタスク（Notion TSK-N など）に取り組む際の標準ワークフロー（課題提示→課題共有→設計議論→実装議論→実装作業→評価→後処理 の 7 フェーズ）。新規タスク着手時、ユーザーが「TSK-N に取り組む」「このタスクをやる」「ワークフローに沿って進める」等と指示した場合に必ず起動する。
---

# Petal タスク遂行ワークフロー（7 フェーズ）

Petal の標準タスク遂行手順。原典は [docs/specs/03_workflow.md](../../../docs/specs/03_workflow.md)、要約は [docs/40_processes/01_workflow.md](../../../docs/40_processes/01_workflow.md)。
このファイルと `docs/` が矛盾した場合は **`docs/` を正とする**。

## 参照（先に読む）

- 設計思想・前提・破壊的操作の禁止 → [_shared/design-philosophy.md](../_shared/design-philosophy.md)
- 方針確認の構造化 → [_shared/askuserquestion-policy.md](../_shared/askuserquestion-policy.md)
- Notion DB の ID・プロパティ → [_shared/notion-refs.md](../_shared/notion-refs.md)
- 各フェーズの出口判定チェックリスト → [references/phase-checklists.md](references/phase-checklists.md)
- Phase 5 サブエージェント起動テンプレ → [references/subagent-prompt.md](references/subagent-prompt.md)
- 自主レビュー観点 → [references/self-review.md](references/self-review.md)
- 完了条件の機械検証 → [scripts/verify.sh](scripts/verify.sh)

## 設計思想（要点）

- **1〜4 はユーザーと AI の議論フェーズ** → 設計書を「曖昧さゼロの実行契約」まで詰める。
- **5 はバックグラウンドのサブエージェント作業フェーズ** → worktree 上で自走、ユーザーは別作業へ。
- **6〜7 はユーザー検品と後片付け。**
- 議論を厚くするほど、質問できないサブエージェントでも完走でき、実装中の確認がゼロになる。
  詳細は [_shared/design-philosophy.md](../_shared/design-philosophy.md)。

各フェーズ末尾で AI が**出口判定**を行い「次フェーズへ進んでよいか」を確認する（必須確認は Phase 2 / 3 / 4）。

## フェーズ進行表

| # | フェーズ | 主体 | 入力 | 成果物 | 出口判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | 課題提示 | ユーザー | （ユーザー指示） | Notion 課題シート | ユーザー指示で完了 |
| 2 | 課題共有 | ユーザー + AI | Notion 課題シート | 確定した課題シート | **必須確認** |
| 3 | 設計議論 | ユーザー + AI | 課題シート | `docs/tsk-N_<slug>.md` | **必須確認** + ブランチ作成 |
| 4 | 実装議論 | ユーザー + AI | 設計書 | 設計書末尾に「実装計画」追記 | **必須確認** |
| 5 | 実装作業 | AI（worktree サブエージェント・BG） | 設計+実装計画 | コミット済みブランチ + 自主レビュー | 完了条件達成で次へ |
| 6 | 評価 | ユーザー + AI | ブランチ | マージ済み PR | マージ完了報告で次へ |
| 7 | 後処理 | AI | マージ通知 | Notion ステータス「完了」 | 完了 |

## 実行手順

### Phase 1: 課題提示

ユーザーが Notion タスクテンプレートで課題を作成し「TSK-N に取り組む」等の指示を出す。
AI は **`notion-update-page` で Notion タスクのステータスを「進行中」に更新**し、Phase 2 へ。

### Phase 2: 課題共有（必須確認）

1. `notion-fetch` で Notion タスクを取得し、各項目をパース（見出し固定: 一行サマリ / 背景・動機 / 完了条件 / スコープ外 / 制約 / 関連資料 / 不明点・迷い）。
2. 空欄・矛盾・曖昧な点を抽出してユーザーへ質問。必要に応じ `docs/` を読み課題理解を補強。
3. 出口判定 → [references/phase-checklists.md](references/phase-checklists.md#phase-2-課題共有必須確認)。合意後、課題シートはフリーズ。

### Phase 3: 設計議論（必須確認 + ブランチ作成）

1. 課題シートから**論点を抽出**し、各論点を**案 A/B/C のメリット・デメリット付きで順次議論**（[AskUserQuestion 方針](../_shared/askuserquestion-policy.md)）。
2. 方針確定。決定はその場で設計書に反映する。
3. `docs/tsk-N_<slug>.md` に書き起こす（**判断理由を併記**）。課題シートはコピーして冒頭に転記。
4. [AGENTS.md](../../../AGENTS.md) のドキュメント表に追記。
5. **作業ブランチを作成し設計書を先行コミット**（`feat/tsk-<番号>-<short-slug>` / `fix/...` / `docs/...`）。
6. 設計書の必須セクション・出口判定 → [references/phase-checklists.md](references/phase-checklists.md#phase-3-設計議論必須確認--ブランチ作成)。

### Phase 4: 実装議論（必須確認・実行契約合格判定）

1. 設計書を読み実装作業を分解。**影響範囲のファイルを全部読む**（既存コード調査）。
2. 実装計画書ドラフトを作成・提示。
3. **ドライラン**: 脳内で各コミットを書き、決めかねる箇所（判断ポイント）を**すべて**洗い出す。
4. 判断ポイントをユーザーへ質問しすべて事前解決。実装計画の「事前解決済みの判断ポイント」に記録。
5. 実装計画の必須セクション・想定外時ルール・出口判定 → [references/phase-checklists.md](references/phase-checklists.md#phase-4-実装議論実行契約合格判定最重要)。

### Phase 5: 実装作業（バックグラウンド worktree サブエージェント）

設計書を**実行契約**として worktree 上のサブエージェントにバックグラウンド実装させる。
起動手順・サブエージェントのアクション・完了条件・完了通知後の対応はすべて
[references/subagent-prompt.md](references/subagent-prompt.md) に従う。完了条件の機械検証は
`bash .claude/skills/skill-workflow/scripts/verify.sh all`。

### Phase 6: 評価

1. `git push -u origin <branch>` → `gh pr create --base main ...` で PR 作成。
2. PR にラベル `author: ai` を付与。
3. **`notion-update-page` で Notion タスクの `PR` プロパティ（URL）に PR URL を書き込む**。
4. PR URL をユーザーへ報告。

PR タイトル: `<type>(tsk-N): <要約>`（日本語可）。
PR 本文: **概要** / **関連**（TSK-N、Notion URL、設計書相対リンク）/ **主な変更点** / **動作確認**（設計書シナリオをチェックリスト転記）/ **補足 / 注意事項**。
ユーザー指摘 → AI が**同 PR に追加コミット**で修正（指摘 → 修正のループ）。
制約: 自動マージ・force push なし。`--draft` は明示意図時のみ。

### Phase 7: 後処理

- `notion-update-page` で Notion タスクのステータスを**「完了」**に更新。
- `git switch main && git pull` で main 更新。
- **ブランチ削除はユーザー指示があった時のみ**（破壊的操作の慎重運用）。

## 例外（小規模タスクの圧縮ルール）

| タスク規模 | Phase 2 | Phase 3 | Phase 4 | ドライラン |
| --- | --- | --- | --- | --- |
| typo / コメント / リネーム | スキップ可 | スキップ可 | スキップ可 | **省略不可** |
| ファイル 1〜2 個・既存パターン踏襲 | 短縮可 | 設計書は省略不可（1 行でも残す） | 最小化可 | **省略不可** |
| 通常タスク | 完全実施 | 完全実施 | 完全実施 | 完全実施 |

スキップ時も Notion ステータス更新 / ブランチ作成 / 日本語コミット / PR 作成は守る。
ドライランは AI の独断進行を防ぐ最後の砦のため**規模問わず省略不可**。
