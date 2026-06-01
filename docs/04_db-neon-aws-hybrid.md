# 04. インフラ構成方針：DB のみ Neon / その他 AWS

## 0. このドキュメントの位置付け

- ステータス：**採用済み（dev 稼働中）**
- 目的：個人運用での AWS 費用（特に RDS の常時課金）を圧縮しつつ、改修コストを最小に抑える構成方針を定める。
- 採用 DB：**Neon（Serverless Postgres）**。当初は Supabase を想定していたが、実装段階で Neon を採用した（経緯は末尾「補足：他案との比較」を参照）。
- 番号レンジ：`00〜03` の基盤ドキュメント群に連なる「インフラ方針」として `04_` を採番。`02_ implementations.md` の技術スタック前提に対する **DB の選定方針** を本ドキュメントで補完する。

## 1. 背景

Petal は当初、本番インフラを以下の AWS 構成で想定していた。

- API サーバー：Lambda + API Gateway
- Frontend：Amplify Hosting
- 認証：Cognito
- ストレージ：S3
- DB：RDS for PostgreSQL（想定）

しかし個人運用では **RDS の常時課金（月 $12〜15）が固定費として重い**。一方で Lambda / Cognito / S3 / Amplify は無料枠 or 従量課金で個人レベルなら月 $1〜5 に収まるため、**ボトルネックは DB のみ**。

GCP 全面移行・Render・Supabase などを比較したうえで、**「DB だけ外部のサーバーレス Postgres に逃がし、それ以外は AWS のまま」** が改修コスト・ランニングコスト・運用のバランスで最良と判断した。最終的に DB は **Neon** を採用している。

検討経緯の比較は本ファイル末尾「補足：他案との比較」を参照。

## 2. 採用構成

```text
[Next.js / Amplify Hosting (ap-northeast-1)]
            ↓ HTTPS
[NestJS / Lambda + API Gateway (ap-northeast-1)]
   ├──→ AWS Cognito (ap-northeast-1)              ← 認証（既存）
   ├──→ AWS S3 (ap-northeast-1)                    ← 画像（既存）
   └──→ Neon Postgres (ap-southeast-1 / Singapore) ← DB のみ（新規）
```

- **Neon は DB（Postgres）機能のみ利用**。
- AWS 各サービスは **ap-northeast-1（東京）**。Neon リージョンは **ap-southeast-1（シンガポール）**。
  - Neon は東京リージョン未提供のため、Lambda（東京）↔ Neon（シンガポール）は **リージョン跨ぎ**となり、クエリあたり数十 ms のレイテンシが乗る。個人運用・低トラフィック前提では許容範囲として採用している（将来トラフィックが増えた場合は再評価）。
- Lambda は VPC に入れない（Neon はインターネット経由で接続）。NAT Gateway 不要で月 $30+ の節約になる。

## 3. 費用見積（個人運用・低トラフィック前提）

| 項目 | 月額目安 |
| --- | --- |
| Lambda + API Gateway | ~$0（無料枠内） |
| Cognito | $0（MAU 50,000 まで無料） |
| S3（数 GB） | ~$0.5 |
| Amplify Hosting | $1〜5 |
| Neon Free（DB） | **$0** |
| **合計** | **$2〜6/月** |

RDS を使う場合（$15〜25/月）と比較して **約 1/4 〜 1/5** に圧縮できる。

## 4. Neon Free プランの制約と対策

| 制約 | 内容 | 対策 |
| --- | --- | --- |
| ストレージ上限 | Free プランの容量上限。画像メタデータ用途なら数年は余裕 | サイズ監視を定期で行う |
| compute 自動サスペンド | 一定時間アクセスがないと compute がゼロにスケールダウン（次回接続で復帰、ただしコールドスタートが乗る） | 週次 keep-alive で定期的にアクセスを発生させる |
| バックアップなし | Free プランは自動バックアップ・PITR なし | GitHub Actions で **週次に `pg_dump` を実行 → S3 に退避** するワークフローを用意する（[42](42_operational-jobs.md)） |
| direct 接続数の上限 | Lambda から直結するとすぐ枯渇しうる | **Pooler（`-pooler` エンドポイント）経由で接続する**（後述） |

運用ジョブ（keep-alive / pg_dump バックアップ）の詳細は [42_operational-jobs.md](42_operational-jobs.md) を参照。

## 5. 接続方法（最重要・実装ポイント）

Neon は **同一ポート（5432）でホスト名により Pooler と Direct を区別**する。Supabase のような「ポート番号での切り替え（6543 / 5432）」ではない点に注意。**用途で必ず使い分ける**。

```text
# Direct 接続（ホスト名に -pooler が付かない）
#  - マイグレーション・DDL 実行・セッションを跨ぐ処理（pg_dump 等）で使用
postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/petal?sslmode=require&channel_binding=require

# Pooler 接続（ホスト名に -pooler が付く / PgBouncer transaction mode）
#  - Lambda（NestJS ランタイム）からのアプリケーション接続で使用
postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/petal?sslmode=require&channel_binding=require
```

### なぜ Pooler が必要か

- Lambda は同時実行ごとに別プロセスが立ち上がり、それぞれが Postgres に TCP 接続を張る。
- 同時実行数 = 接続数となるため、`max_connections` の上限にすぐ達しうる。
- Pooler（Neon が提供する PgBouncer）を経由すると、多数のクライアント接続を保持しつつ実 Postgres へは少数の接続を使い回すため枯渇しない。

### 環境変数の分け方

`backend/.env`（および各環境）で 2 つを定義する。

```dotenv
# アプリ実行時（Lambda → DB / Pooler エンドポイント）
DATABASE_URL=postgresql://...-pooler.../petal?sslmode=require&channel_binding=require

# マイグレーション実行時（CI / ローカル / Direct エンドポイント）
DATABASE_URL_DIRECT=postgresql://....../petal?sslmode=require&channel_binding=require
```

TypeORM の DataSource 構築時は `DATABASE_URL`（Pooler）を読む。マイグレーション CLI は `DATABASE_URL_DIRECT`（Direct）を読むよう設定を分ける（[34_typeorm-neon.md](34_typeorm-neon.md)）。

### TypeORM 側の必須設定

Pooler は transaction mode で動くため、セッションを跨ぐ機能（prepared statement, セッション変数等）が使えない。以下を必ず設定する。

- `ssl: { rejectUnauthorized: false }` を有効化（Neon は SSL 必須・`sslmode=require`）。
- prepared statement を無効化する。pg ドライバ経由なら `extra: { prepareThreshold: 0 }` 相当の設定。
- コネクションプールは Lambda 側でも絞る。`extra: { max: 1 }` 程度。
- `DataSource` は **Lambda ハンドラの外でモジュールスコープにシングルトン化**する（warm 起動で再利用される）。

## 6. 移行・構築時の作業手順（チェックリスト）

1. **Neon プロジェクトを作成**
   - Free プランで OK
   - DB（`petal`）と接続文字列（Pooler / Direct 両方）を取得し安全に保管
2. **既存のマイグレーションを Neon に適用**
   - ローカルから `DATABASE_URL_DIRECT`（Direct エンドポイント）を指して `pnpm --filter backend migration:run`
3. **TypeORM 設定の更新**
   - SSL 有効化
   - `extra: { max: 1, prepareThreshold: 0 }` 等の Pooler 対応
4. **環境変数の整備**
   - Lambda 側：`DATABASE_URL`（Pooler エンドポイント）
   - CI 側：`DATABASE_URL_DIRECT`（Direct エンドポイント）
   - `backend/.envs/.env.dev.example` に 2 つとも記載（値は伏せ字）
5. **動作確認**
   - ローカルから Neon に接続して認証フロー / 画像登録 / 監査ログ等が動くか確認
   - Lambda にデプロイし、コネクション枯渇が出ないか同時負荷で軽く確認
6. **運用ジョブの整備**
   - keep-alive：GitHub Actions で週 1 回 `SELECT 1`
   - バックアップ：GitHub Actions で週次 `pg_dump` → S3
   - 詳細は [42_operational-jobs.md](42_operational-jobs.md)
7. **既存 RDS（あれば）の解放**
   - 構築前であれば不要

## 7. 留意事項・将来検討

- **ストレージや compute hours が Free の上限に近づいたら** Neon Pro または別 DB への再移行を検討する。
- **本番ユーザーが付いてきた段階**で、Free の自動サスペンド / バックアップなしは許容できなくなる。その時点で Pro に上げるか、RDS に戻すかを再評価する。
- **東京リージョン未提供によるレイテンシ**は現状許容している。レイテンシがボトルネックになった場合は、東京提供のマネージド Postgres（RDS 等）への移行を検討する。
- **Cognito → 他 Auth への乗り換えは行わない**。MFA (TSK-13) や GlobalSignOut (TSK-14, 19, 23) など Cognito 固有機能で実装済みのものを再設計するコストが大きいため、認証は AWS のまま据え置く。

## 8. 補足：他案との比較（検討経緯）

> 下表は選定時の検討メモ。当初は「AWS + Supabase Free（Tokyo, DB のみ）」を有力としていたが、**実装段階では Neon（ap-southeast-1）を採用**した。Neon は東京未提供のためレイテンシ面では不利だが、Free プランの使い勝手・DX を優先し、跨ぎレイテンシを許容するトレードオフを取っている。

| 案 | 月額目安 | 改修規模 | メモ |
| --- | --- | --- | --- |
| AWS 全面（RDS 利用） | $15〜25 | なし | 個人運用には DB 固定費が重い |
| GCP 全面移行（Cloud Run + Identity Platform + Cloud SQL） | $10〜15 | **大**（Cognito → Identity Platform の作り直しが TSK-13/14/19/23 に直撃） | 改修コストが費用削減に見合わない |
| AWS + Supabase Free（Tokyo, DB のみ） | $2〜6 | 小 | 当初の有力案。同 region でレイテンシ問題なし |
| **AWS + Neon Free（Singapore, DB のみ）** | **$2〜6** | **小** | **採用**。東京未提供で跨ぎレイテンシが乗るが、Free の使い勝手を優先 |
| Render | — | 中 | Free Postgres は 90 日で削除されるため本運用に不向き |

## 9. 参考リンク

- [Neon Docs — Connect from any application](https://neon.tech/docs/connect/connect-from-any-app)
- [Neon Docs — Connection pooling](https://neon.tech/docs/connect/connection-pooling)
- [Neon Pricing](https://neon.tech/pricing)
- 本リポジトリ関連ドキュメント：[02_ implementations.md](02_%20implementations.md), [34_typeorm-neon.md](34_typeorm-neon.md), [42_operational-jobs.md](42_operational-jobs.md)
