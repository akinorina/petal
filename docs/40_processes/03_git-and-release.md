# Git 運用・リリース

## コミット

- コミットメッセージは **日本語**。
- 破壊的操作（`git push --force` / `git reset --hard` / `branch -D` 等）はユーザーの明示的許可なく実行しない。

## ブランチとリリース運用（release ブランチ方式）

原典: [specs/55_release-branch-cicd.md](../specs/55_release-branch-cicd.md)。

- 開発は `main` で行う。全 PR は `main` に向ける。
- `main` への push では **CI のみ** が走る（Lambda / Amplify はデプロイされない）。
- デプロイは **`release` ブランチへの push** が起点。`release` の更新は GitHub Actions の `Promote main to release`（`workflow_dispatch`）で `main` をマージして行う。
- **`release` への直接 push は禁止**（GitHub Free プランで Branch protection が使えないため運用ルールで担保）。

```text
main (開発・CI のみ)
  │  Promote main to release (workflow_dispatch)
  ▼
release (push → デプロイ: Amplify / Lambda)
```

詳細な CI/CD ワークフローは [30_operations/06_cicd.md](../30_operations/06_cicd.md) を参照。

## ファイル削除（.trash 退避）

- ファイル・ディレクトリ削除は `rm` で物理削除せず、リポジトリ直下の `.trash/`（`.gitignore` 済み・Git 管理外）へ `mv` で退避する。
- AI エージェントも `rm` を使わず `mv <対象> .trash/` で退避する（誤削除の保険）。
- 図の中間生成物（`.drawio` 等）や一時ファイルの片付けも同様。
- 同名衝突を避けたい場合はリネームして退避（例: `mv foo.txt .trash/foo.$(date +%s).txt`）。

## 関連ドキュメント

- CI/CD → [30_operations/06_cicd.md](../30_operations/06_cicd.md)
- ワークフロー → [01_workflow.md](01_workflow.md)
- 原典 → [specs/00_rules.md](../specs/00_rules.md) §6, [specs/55_release-branch-cicd.md](../specs/55_release-branch-cicd.md)
