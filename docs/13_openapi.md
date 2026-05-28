# Petal - OpenAPI / Swagger 連携

Backend (NestJS) で OpenAPI 仕様を生成し、Frontend (Next.js) で `openapi-typescript` + `openapi-fetch` により型付きクライアントを生成する。

## 1. 構成

```text
backend/openapi.json                ← Backend が生成する OpenAPI 3.x 仕様（Git 管理）
frontend/lib/openapi/schema.d.ts    ← openapi-typescript が生成する型定義（Git 管理）
frontend/lib/openapi/client.ts      ← openapi-fetch ベースの型付きクライアント
frontend/lib/api.ts                 ← UI から呼び出すドメインごとの API ラッパ
```

## 2. Backend 側

- `@nestjs/swagger` を使用。Swagger CLI Plugin を [backend/nest-cli.json](../backend/nest-cli.json) で有効化しており、DTO クラスのプロパティから OpenAPI スキーマを自動推論する。
- enum / `Date` などプラグインで推論できない箇所のみ DTO に `@ApiProperty(...)` を付与する。
- 認証要否は controller に `@ApiBearerAuth('bearer')` を付ける（`auth/login` など Public なものは付けない）。
- レスポンスの `Date` 型は controller の整形関数で `toISOString()` し、DTO 側は `string`（`format: 'date-time'`）として宣言する。

### Swagger UI / JSON エンドポイント

`cd backend && pnpm start:dev` 実行中：

- Swagger UI: <http://localhost:3000/api-docs>
- OpenAPI JSON: <http://localhost:3000/api-docs-json>

### 仕様ファイルの書き出し

```bash
cd backend && pnpm openapi:export
# → backend/openapi.json を更新
```

このスクリプトは Swagger CLI Plugin の効いたビルド成果物（`dist/src/openapi-export.js`）を実行する。`nest build` を内部で行う。

## 3. Frontend 側

```bash
cd frontend && pnpm openapi:gen
# → frontend/lib/openapi/schema.d.ts を更新
```

入力は `../backend/openapi.json`（backend / frontend は別 pnpm プロジェクトだが同一リポジトリのため相対パスで参照できる）。Backend 側の DTO を変更したら **Backend export → Frontend gen** の順に再生成する。

### 利用方法

`frontend/lib/api.ts` の `imageApi` / `userApi` を import して使う。レスポンス型は `Schemas['<DtoName>']`（= `components['schemas']['<DtoName>']`）として参照する。

```ts
import { imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type ImageItem = Schemas['ImageResponseDto'];
const items: ImageItem[] = await imageApi.findAll();
```

認証トークン付与は `lib/openapi/client.ts` の middleware で `getAccessToken()` を呼び自動的に行う（既存の挙動を踏襲）。

## 4. ルール

- DTO クラス（`backend/src/<feature>/controller/*.dto.ts`）が API 契約の **真実のソース**。これを編集したら必ず `openapi:export` → `openapi:gen` を実行する。
- 生成物（`backend/openapi.json` と `frontend/lib/openapi/schema.d.ts`）は Git 管理する。レビュー時に API 変更が diff に現れる。
- `frontend/lib/openapi/schema.d.ts` は自動生成。手で編集しない。
- `lib/api.ts` 以外から `apiClient` を直接呼ばない（共通エラー処理 `unwrap()` を経由するため）。
