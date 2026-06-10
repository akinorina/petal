# release ブランチによる CI/CD 起動制御 設計（PRJ-11）

## 目的

`main` への push のたびに走っていた Amplify / Lambda の自動デプロイを止め、デプロイ起動を **`release` ブランチへの push 時のみ** に限定する。これにより AWS のビルド・関数更新の費用を抑え、リリースタイミングを人が明示的にコントロールできるようにする。

## ブランチ戦略

| ブランチ | 役割 |
| --- | --- |
| `main` | 開発の既定ブランチ。全 PR は `main` に向けてマージする。`main` への push では **CI のみ** が起動する。 |
| `release` | デプロイ起点ブランチ。`release` への push で **CI と CD（Lambda）+ Amplify ビルド** が起動する。直接 push 禁止。 |

`release` ブランチへの更新は原則として `promote-to-release` ワークフロー（後述）経由で `main` をマージして行う。

> **補足**: GitHub Free プランのプライベートリポジトリでは Branch protection / Rulesets が利用できないため、`release` ブランチへの直接 push 禁止は **運用ルール** で担保する。

## CI / CD の起動条件

### CI（`.github/workflows/ci.yml`）

- `pull_request` （全 PR）
- `push: branches: [main, release]`
- ジョブ: backend / frontend / lighthouse

### CD（`.github/workflows/deploy.yml`）

- `push: branches: [release]` のみ
- ジョブ: backend build → bundle → Lambda `update-function-code`

### Amplify（frontend）

- Amplify Console 側で `release` ブランチに接続。`main` は接続解除または Auto build オフ。
- カスタムドメインの本番サブドメインは `release` ブランチをターゲットにする。

## promote-to-release ワークフロー（`.github/workflows/promote-to-release.yml`）

`main` を `release` にマージするための **手動実行ワークフロー**。

### トリガ

- `workflow_dispatch`
- 入力（任意）:
  - `tag` … リリースタグ名（例: `v1.2.3`）。空ならタグ付与なし。
  - `release_notes` … タグ付与時に GitHub Release に含めるノート。

### 処理

1. `release` を checkout（`fetch-depth: 0`）
2. `main` を fetch
3. `git merge --ff-only main` を試行
4. fast-forward 不可なら `git merge --no-ff main -m "chore: promote main to release"`
5. `release` を origin に push（→ CI / CD / Amplify が起動）
6. `tag` 入力があれば、タグ付与と GitHub Release 作成

### 権限

- `permissions: contents: write`（push とタグ作成に必要）
- 実行可能ユーザの制限は GitHub Free 制約により Branch protection で縛れないため、運用ルールで管理。

## リリース手順

通常リリース：

1. `main` で開発を進め、PR を `main` にマージしていく。
2. リリースしたいタイミングで GitHub の **Actions タブ → "Promote main to release"** を `workflow_dispatch` で実行する。
    - 必要ならタグ名（`v1.2.3` など）とリリースノートを入力。
3. ワークフロー成功後、`release` ブランチへの push をトリガに CI / CD / Amplify が自動で動く。
4. 完了後、本番動作を疎通確認する。

緊急時 hotfix：

- 原則は `main` で hotfix → PR マージ → `promote-to-release` を流す（通常リリースと同じ動線）。
- `release` への直接 push は禁止（運用ルール）。どうしても必要なら、後追いで `release` の修正を `main` にも反映すること。

## やってはいけないこと

- `release` への直接 push（promote ワークフロー経由のみ）。
- Amplify コンソールで `main` の自動ビルドを復活させる。
- `deploy.yml` のトリガに `main` を再追加する。

## 関連タスク

- TSK-96: `release` ブランチ作成（保護は Free プラン制約により運用ルール化）
- TSK-97: `ci.yml` のトリガに `release` を追加
- TSK-98: `deploy.yml` のトリガを `release` のみに変更
- TSK-99: `promote-to-release.yml` 新規作成
- TSK-100: Amplify ブランチ切替
- TSK-101: 本ドキュメント（リリース運用フローの追記）
- TSK-102: 初回リリース疎通確認
