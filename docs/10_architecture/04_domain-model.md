# ドメインモデル

ドメインの概念をエンティティ・値オブジェクトとしてコードに反映する。不変条件は Zod スキーマで宣言し、コンストラクタで実行時バリデーションする。

## 不変条件の表現方針

ドメインの制約（型・形式・範囲）は Zod スキーマで定義し、「不正な状態のインスタンスは存在しない」ことを保証する。

- フィールド制約は `<Name>Schema`（Zod）で定義する。
- TypeScript 型は `z.infer<typeof <Name>Schema>` で生成し、手書き型と二重定義しない。
- コンストラクタはプロパティオブジェクトを 1 つだけ受け取り、先頭で `<Name>Schema.parse(props)` を呼ぶ。位置引数は使わない。

例（[backend/src/user/domain/user.ts](../../backend/src/user/domain/user.ts)）:

```ts
export const UserSchema = z.object({
  id: z.uuid(),
  cognitoSub: z.string().min(1),
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.enum(UserRole),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
export type UserProps = z.infer<typeof UserSchema>;

export class User {
  constructor(props: UserProps) {
    const validated = UserSchema.parse(props);
    // 検証済みの値だけをフィールドへ代入
  }
}
```

## 主なエンティティ

### User（[backend/src/user/domain/](../../backend/src/user/domain/)）

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| id | uuid | 主キー |
| cognitoSub | string | Cognito ユーザーの `sub`（突合キー） |
| email | string | メールアドレス |
| name / nameKana | string(1..100) | 氏名・カナ |
| role | UserRole(`admin`/`user`) | ロール |
| createdAt / updatedAt | date | 作成・更新 |
| deletedAt | date \| null | 論理削除（NULL=有効） |

### Image（[backend/src/image/domain/](../../backend/src/image/domain/)）

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| id | uuid | 主キー |
| ownerUserId | uuid | 所有者（User） |
| s3Key | string | S3 オブジェクトキー（一意） |
| originalFilename | string | アップロード時のファイル名 |
| mimeType | string | MIME タイプ |
| sizeBytes | bigint | ファイルサイズ |
| title / description | string \| null | 任意メタ情報 |
| createdAt / updatedAt / deletedAt | date | 作成・更新・論理削除 |

画像は所有者のみ閲覧可。所有者ユーザーは `onDelete: RESTRICT`（画像が残るユーザーは物理削除できない設計）。

### AuditLog（[backend/src/audit/domain/](../../backend/src/audit/domain/)）

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| id | uuid | 主キー |
| actorUserId | uuid | 操作者 |
| action | AuditAction(enum) | 操作種別 |
| targetUserId | uuid \| null | 操作対象ユーザー |
| metadata | jsonb \| null | 付随情報 |
| createdAt | date | 記録日時 |

監査ログは **追記専用**。`deletedAt` を持たず、更新/削除 API を提供しない。

### LoginAttempt（[backend/src/auth/infra/login-attempt.entity.ts](../../backend/src/auth/infra/login-attempt.entity.ts)）

ログインロックアウト用。email を主キーに失敗回数・初回失敗時刻・ロック解除時刻を保持する（Lambda 前提のため in-memory ではなく DB ストア）。

## 列挙型

| enum | 値 | 用途 |
| ---- | -- | ---- |
| `UserRole` | `admin` / `user` | ロール |
| `AuditAction` | ユーザー作成/更新/削除/復活 等 | 監査ログの操作種別 |

## 関連ドキュメント

- DB スキーマ（テーブル定義） → [05_database-schema.md](05_database-schema.md)
- バックエンド設計 → [02_backend-architecture.md](02_backend-architecture.md)
