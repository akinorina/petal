# 04. インフラ構成方針：DB のみ Supabase / その他 AWS

## 0. このドキュメントの位置付け

- ステータス：**方針確定・未実施**
- 目的：個人運用での AWS 費用（特に RDS の常時課金）を圧縮しつつ、改修コストを最小に抑える構成方針を定める。
- 適用時期：未定。実際に着手する際の手順書として参照する。
- 番号レンジ：`00〜03` の基盤ドキュメント群に連なる「インフラ方針」として `04_` を採番。`02_ implementations.md` の技術スタック前提に対する **DB の選定方針** を本ドキュメントで補完する。

## 1. 背景

Petal は当初、本番インフラを以下の AWS 構成で想定していた。

- API サーバー：Lambda + API Gateway
- Frontend：Amplify Hosting
- 認証：Cognito
- ストレージ：S3
- DB：RDS for PostgreSQL（想定）

しかし個人運用では **RDS の常時課金（月 $12〜15）が固定費として重い**。一方で Lambda / Cognito / S3 / Amplify は無料枠 or 従量課金で個人レベルなら月 $1〜5 に収まるため、**ボトルネックは DB のみ**。

GCP 全面移行・Render・Supabase フル利用なども比較した結果、**「DB だけ Supabase に逃がし、それ以外は AWS のまま」** が改修コスト・ランニングコスト・レイテンシのバランスで最良と判断した。

検討経緯の比較は本ファイル末尾「補足：他案との比較」を参照。

## 2. 採用構成

```text
[Next.js / Amplify Hosting (ap-northeast-1)]
            ↓ HTTPS
[NestJS / Lambda + API Gateway (ap-northeast-1)]
   ├──→ AWS Cognito (ap-northeast-1)            ← 認証（既存）
   ├──→ AWS S3 (ap-northeast-1)                  ← 画像（既存）
   └──→ Supabase Postgres (ap-northeast-1 Tokyo) ← DB のみ（新規）
```

- **Supabase は DB 機能のみ利用**。Auth / Storage / Edge Functions は使わない。
- リージョンはすべて **ap-northeast-1（東京）** で揃える → リージョン跨ぎのレイテンシなし。
- Lambda は VPC に入れない（Supabase はインターネット経由で接続）。NAT Gateway 不要で月 $30+ の節約になる。

## 3. 費用見積（個人運用・低トラフィック前提）

| 項目 | 月額目安 |
| --- | --- |
| Lambda + API Gateway | ~$0（無料枠内） |
| Cognito | $0（MAU 50,000 まで無料） |
| S3（数 GB） | ~$0.5 |
| Amplify Hosting | $1〜5 |
| Supabase Free（DB） | **$0** |
| **合計** | **$2〜6/月** |

RDS を使う場合（$15〜25/月）と比較して **約 1/4 〜 1/5** に圧縮できる。

## 4. Supabase Free プランの制約と対策

| 制約 | 内容 | 対策 |
| --- | --- | --- |
| DB サイズ 500 MB | 画像メタデータ用途なら数年は余裕 | サイズ監視を定期で行う |
| 自動 pause | **7 日間アクセスがないとプロジェクトが pause** される | Lambda の EventBridge スケジュール（cron）で週次に `SELECT 1` を打つ keep-alive を仕込む |
| バックアップなし | Free プランは自動バックアップ・PITR なし | GitHub Actions で **週次に `pg_dump` を実行 → S3 に退避** するワークフローを用意する |
| direct 接続数 60 程度 | Lambda から直結するとすぐ枯渇 | **Pooler（transaction mode, port 6543）経由で接続する**（後述） |

## 5. 接続方法（最重要・実装ポイント）

Supabase は接続文字列を 2 種類発行する。**用途で必ず使い分ける**。

```text
# Direct 接続（5432 ポート）
#  - マイグレーション・DDL 実行・LISTEN/NOTIFY が必要な処理で使用
postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres

# Transaction Pooler（6543 ポート）
#  - Lambda（NestJS ランタイム）からのアプリケーション接続で使用
postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### なぜ Pooler が必要か

- Lambda は同時実行ごとに別プロセスが立ち上がり、それぞれが Postgres に TCP 接続を張る。
- 同時実行数 = 接続数となるため、`max_connections` の上限（Free では数十）にすぐ達する。
- Pooler（Supabase 側で立っている PgBouncer）を経由すると、クライアント接続を最大 200（Free）まで保持しつつ、実 Postgres へは少数の接続を使い回すため枯渇しない。

### 環境変数の分け方

`backend/.env`（および本番環境）で 2 つを定義する。

```dotenv
# アプリ実行時（Lambda → DB）
DATABASE_URL=postgresql://...:6543/postgres

# マイグレーション実行時（CI / ローカル）
DATABASE_URL_DIRECT=postgresql://...:5432/postgres
```

TypeORM の DataSource 構築時は `DATABASE_URL` を読む。マイグレーション CLI は `DATABASE_URL_DIRECT` を読むよう設定を分ける。

### TypeORM 側の必須設定

Pooler は transaction mode で動くため、セッションを跨ぐ機能（prepared statement, セッション変数等）が使えない。以下を必ず設定する。

- `ssl: { rejectUnauthorized: false }` を有効化（Supabase は SSL 必須）。
- prepared statement を無効化する。pg ドライバ経由なら `extra: { prepareThreshold: 0 }` 相当の設定。
- コネクションプールは Lambda 側でも絞る。`extra: { max: 1 }` 程度。
- `DataSource` は **Lambda ハンドラの外でモジュールスコープにシングルトン化**する（warm 起動で再利用される）。

## 6. 移行時の作業手順（後日実施するときのチェックリスト）

1. **Supabase プロジェクトを ap-northeast-1（Tokyo）で作成**
   - Free プランで OK
   - DB パスワードを安全に保管
2. **既存のマイグレーションを Supabase に適用**
   - ローカルから `DATABASE_URL_DIRECT`（5432）を指して `pnpm --filter backend migration:run`
3. **TypeORM 設定の更新**
   - SSL 有効化
   - `extra: { max: 1, prepareThreshold: 0 }` 等の Pooler 対応
4. **環境変数の整備**
   - Lambda 側：`DATABASE_URL`（6543 = Pooler）
   - CI 側：`DATABASE_URL_DIRECT`（5432 = direct）
   - `backend/.env.example` に 2 つとも記載（値は伏せ字）
5. **動作確認**
   - ローカルから本番 Supabase に接続して認証フロー / 画像登録 / 監査ログ等が動くか確認
   - Lambda にデプロイし、コネクション枯渇が出ないか同時負荷で軽く確認
6. **運用ジョブの整備**
   - keep-alive：EventBridge で週 1 回 Lambda を叩いて `SELECT 1`
   - バックアップ：GitHub Actions で週次 `pg_dump` → S3
7. **既存 RDS（あれば）の解放**
   - 構築前であれば不要

## 7. 留意事項・将来検討

- **DB サイズが 500 MB を超えそうになったら** Supabase Pro（$25/月）または別 DB への再移行を検討する。Pro でも RDS より安いケースが多い。
- **本番ユーザーが付いてきた段階**で、Free の自動 pause / バックアップなしは許容できなくなる。その時点で Pro に上げるか、RDS に戻すかを再評価する。
- **Cognito → Supabase Auth への乗り換えは行わない**。MFA (TSK-13) や GlobalSignOut (TSK-14, 19, 23) など Cognito 固有機能で実装済みのものを再設計するコストが大きいため、認証は AWS のまま据え置く。

## 8. 補足：他案との比較（採用しなかった理由）

| 案 | 月額目安 | 改修規模 | 不採用理由 |
| --- | --- | --- | --- |
| AWS 全面（RDS 利用） | $15〜25 | なし | 個人運用には DB 固定費が重い |
| GCP 全面移行（Cloud Run + Identity Platform + Cloud SQL） | $10〜15 | **大**（Cognito → Identity Platform の作り直しが TSK-13/14/19/23 に直撃） | 改修コストが費用削減に見合わない |
| GCP + Neon Free | $2〜6 | 大（同上） | 同上 |
| AWS + Neon Free（Singapore） | $2〜6 | 小 | Neon は **Tokyo 未提供**。Lambda 東京 ↔ Neon Singapore で +70〜90ms/クエリのレイテンシが乗る |
| **AWS + Supabase Free（Tokyo, DB のみ）** | **$2〜6** | **小** | **採用**。同 region でレイテンシ問題なし、改修コスト最小 |
| Render | — | 中 | Free Postgres は 90 日で削除されるため本運用に不向き |

## 9. 参考リンク

- [Supabase Docs — Connecting to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Pricing](https://supabase.com/pricing)
- 本リポジトリ関連ドキュメント：[02_ implementations.md](02_%20implementations.md)
