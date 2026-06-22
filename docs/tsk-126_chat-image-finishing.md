# TSK-126 画像対応の仕上げ（ドキュメント整備とテスト補完）（設計書）

- Notion: <https://app.notion.com/p/3839ca7d99dc819a8666e77661ee448d>
- プロジェクト: PRJ-17（Petal LLM画像対応）<https://app.notion.com/p/3819ca7d99dc80e7babef670bc6292ae>
- 規模: M / 重要度: MIDDLE
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/04_image-management.md](20_features/04_image-management.md) / [docs/tsk-122_chat-multimodal-persistence.md](tsk-122_chat-multimodal-persistence.md) / [docs/tsk-123_provider-image-vision.md](tsk-123_provider-image-vision.md) / [docs/tsk-124_chat-image-api.md](tsk-124_chat-image-api.md) / [docs/tsk-125_chat-image-frontend.md](tsk-125_chat-image-frontend.md)

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

機能ドキュメント（09_chat.md ほか）へ画像対応を反映し、テスト網羅の最終確認（不足あれば補完）と、実機での全 provider E2E 動作確認手順を整備する。

### 背景・動機

PRJ-17 の仕上げタスク（⑤）。実装（TSK-①〜④ = tsk-122〜125）はマージ済みで backend / frontend ともビルド・ユニットテスト通過済み。現状仕様ドキュメントへ画像添付仕様を反映し、PRJ-17 の完了条件 8 項目の充足を確認する。

### 完了条件

- [ ] docs/20_features/09_chat.md に画像添付（マルチモーダル）の現状仕様が反映されている。
- [ ] docs/20_features/04_image-management.md に「チャットでの画像添付」節がある。
- [ ] テスト網羅をレビューし、明確な不足（application 層）があれば最小補完する。`cd backend && pnpm test` が緑。
- [ ] 実機での全 provider E2E 動作確認手順（チェックリスト）が整備されている（実機確認自体はユーザーが実施）。
- [ ] PRJ-17 完了条件 8 項目の充足状況が表で確認できる。

### スコープ外

- 新機能の追加実装（TSK-①〜④で完結）。
- 実機 E2E のサブエージェント実行（実 API キー・実機 UI・実 S3 が必要なため AI のバックグラウンド実行は不可。手順整備のみ）。
- frontend のユニットテスト本格整備（現状の薄さを維持）。

### 制約

- ドキュメントは現状仕様を正とする運用に従い `docs/` を更新。
- 既存ドキュメント（09_chat.md / 04_image-management.md）の章立て・文体・リンク記法に揃える。
- テスト方針（[02_testing-strategy.md](40_processes/02_testing-strategy.md)）を踏襲し、Infra / Controller をスコープ外として過剰追加しない。

### 不明点・迷い

なし（Phase 2 で 3 点を確定）。

## 2. スコープ

### 対象

- 09_chat.md への画像対応セクション追記（データモデル / API / 送信フロー / vision / 環境変数 / テスト記述更新）。
- 04_image-management.md への「チャットでの画像添付」節の簡潔な追加。
- application 層テストのレビューと最小補完（穴がある場合のみ）。
- 本設計書への手動動作確認シナリオ（全 provider E2E チェックリスト）の整備。
- 関連リンクの整理（09_chat.md 原典欄に tsk-122〜126 を追記）。

### 対象外

- backend / frontend の実装変更（バグを発見した場合は中断して相談）。
- 新規 migration・環境変数・依存追加。
- 自動 e2e テスト（backend/test/*.e2e-spec.ts）の新規作成（Phase 2 で「不足箇所のみ最小補完」を選択）。

## 3. 設計判断ログ

### 判断 1: E2E 動作確認の進め方（採用 = AI が手順書を整備しユーザー実施）

- **採用**: AI は tsk-122〜125 の手動確認シナリオを集約した「動作確認チェックリスト」を本設計書 §6 に整備する。実機での全 provider 確認はユーザーが実施し、結果を PR / Notion に記録する。
- **理由**: Phase 5 のバックグラウンドサブエージェントは worktree 上・質問不可・実 API キー / 実機 UI / 実 S3 なしで動くため、実機 E2E を実行できない。手順を契約化し人手で実施するのが唯一実行可能な形。
- **却下**: 自動 e2e テスト追加（実 provider はモックになり「実機で画像を認識する」という完了条件②を満たせない・CI で実 LLM を叩けない）。

### 判断 2: テスト補完の範囲（採用 = 不足箇所のみ最小補完）

- **採用**: 既存ユニット（domain / application / infra provider）は網羅済み。レビューして明確な穴（application 層）のみ追加する。
- **理由**: テスト方針が Infra / Controller をスコープ外とし、過剰抽象化・過剰追加を避ける方針。実装フェーズで各 TSK が spec を同居整備済み。
- **却下**: backend e2e-spec 新規追加 / frontend ユニット本格整備（いずれもスコープ拡大で本タスク（仕上げ）の趣旨に反する）。

### 判断 3: ドキュメント更新の対象範囲（採用 = 09_chat.md + 04_image-management.md 両方）

- **採用**: 画像添付の本格仕様は 09_chat.md に集約し、04_image-management.md には「画像のチャット添付」への短い導線節を置く。
- **理由**: チャット添付はチャット機能の一部であり詳細は 09 に置くのが自然。一方、画像管理ドキュメントからも添付用途を辿れるようにする。
- **却下**: 09_chat.md のみ（画像管理側からの導線が欠ける）。

### 判断 4: 動作確認チェックリストの配置（採用 = 本設計書 §6）

- **採用**: 手動動作確認シナリオは原典である本設計書（tsk-126）に置く。現状仕様ドキュメント（09_chat.md）には恒久的な仕様のみ書き、検証手順は書かない。
- **理由**: 既存慣例（手動確認シナリオは spec/tsk-N 側、現状仕様は features 側）に整合。

## 4. ドキュメント追記方針

### 4.1 docs/20_features/09_chat.md

実コードに基づき以下を追記・更新する（既存章の間に自然に挿入）。

- **原典欄**: tsk-122〜126 を追記。
- **データモデル**: `petal.chat_message_images` テーブルを追加記載。
  - カラム: id(UUID PK) / message_id(FK→chat_messages, RESTRICT) / image_id(FK→images, RESTRICT) / position(int) / created_at / updated_at / deleted_at（論理削除）。
  - 制約: `UQ(message_id, position)` / `IDX(message_id)`。
  - migration: `1746144008000-CreateChatMessageImages.ts`。
  - ドメイン参照型 `ChatMessageImageRef`（`imageId` + `position`）と `ChatMessage.attachments` を記載。
- **マルチモーダル content（新節）**: ワイヤ表現 `ChatContentPart`（`text` / `image{ mediaType, data(base64) }`）の discriminated union、後方互換（`content` は string も許容）、`contentToText` / `hasImageContent` の役割。
- **API**: `POST /chat/threads/:id/messages` の body に `attachmentImageIds?: string[]`（uuid・最大 5 = `MAX_ATTACHMENTS`）、`GET .../messages` 応答の `attachments: ChatMessageAttachmentDto[]`（imageId / position / mimeType / originalFilename / downloadUrl / expiresInSeconds）を追記。
- **送信フロー**: 既存の番号付きフローに画像処理を反映。
  - 送信前検証（pre-stream）: vision 非対応 provider なら 422 `LLM_VISION_UNSUPPORTED` で block、添付画像は所有者認可（非所有/不在は 404）。`ChatAttachmentService.assertAttachmentsSendable`。
  - 履歴ロード時に各メッセージの添付を `toLlmContent` で base64 の image part へ変換して LLM へ渡す → **過去の添付も毎回再送され文脈維持**。
  - バックエンドが S3 からバイトを取得し base64 化する点（画像管理の「バイトを中継しない」アップロード/ダウンロードとは異なる経路）を明記。
- **エラー分類**: 表に `LLM_VISION_UNSUPPORTED`（422 / retryable=false / pre-stream）を追記。
- **vision 対応可否**: provider 別の `supportsVision()`（Claude=true 固定 / Gemini=true / OpenAI=既定 true / Local=既定 false）。
- **環境変数**: `OPENAI_VISION`（既定 true）/ `LOCALLLM_VISION`（既定 false）を表へ追加（boolean-ish: `true`/`false`/`1`/`0`）。
- **テスト節**: 画像添付の domain / application / infra provider テストが追加されている旨を 1〜2 文で追記。

### 4.2 docs/20_features/04_image-management.md

- 「チャットでの画像添付」節を新規追加（簡潔）。
  - 所有ライブラリ画像を最大 5 枚までチャットに添付し本文と共に送信できる。
  - バックエンドが S3 から取得し base64 化して LLM へ渡す（vision 対応 provider のみ）。
  - 履歴では署名付き表示 URL（`downloadUrl`）として返る。
  - 詳細は [09_chat.md](09_chat.md) を参照。

## 5. テスト補完方針

既存テスト（調査済み・網羅的）:

- domain: `chat-message.spec.ts` / `llm-message.spec.ts` / `vision-unsupported.error.spec.ts`
- application: `chat-attachment.service.spec.ts` / `chat-completion.service.spec.ts` / `chat.service.spec.ts` / `chat-thread.service.spec.ts`
- infra provider: `claude.client.spec.ts` / `gemini.client.spec.ts` / `openai-compatible.client.spec.ts`

方針: 上記を読み、完了条件（permanent な振る舞い）に対する **application 層の明確な穴のみ** 補完する。穴が無ければテスト追加なし（その旨を PR に記載）。具体的に確認する観点:

- 履歴再送で過去メッセージの添付が `toLlmContent` 経由で base64 化され LLM へ渡ること（マルチターン文脈維持）。
- vision 非対応時に pre-stream で 422 になり、メッセージ保存・LLM 呼び出しが行われないこと。
- 添付上限・非所有画像の扱い（404）。

## 6. 手動動作確認シナリオ（全 provider E2E チェックリスト）

実機（ローカル）で実施し、結果を PR にチェック転記する。前提: backend / frontend 起動、migration 適用済み、ログイン済み、画像ライブラリに画像が複数ある。

### 6.1 共通

- [ ] migration 適用後 `petal.chat_message_images` テーブルが存在する。

### 6.2 vision 対応 provider（Claude / Gemini / OpenAI）— 各 provider で実施

`LLM_PROVIDER` を切り替えて各 provider で:

- [ ] ライブラリから 1 枚選択して添付・プレビュー・取り消しができる。
- [ ] 本文＋画像 1 枚を送信し、画像内容に基づく応答が返る。
- [ ] 複数枚（上限 5 枚まで）添付して送信でき、6 枚目は添付できない（上限抑制）。
- [ ] 送信後、ユーザーメッセージのバブルに添付サムネイルが表示される。
- [ ] ページを再読み込みしても履歴に添付画像が表示される（永続化）。
- [ ] 同一スレッドで続けて質問すると、過去の添付画像を踏まえた応答が返る（文脈維持＝再送）。

### 6.3 vision 非対応（Local 既定 / `LOCALLLM_VISION` 未設定）

- [ ] 画像付きで送信すると、送信前に専用エラー（422 `LLM_VISION_UNSUPPORTED`「選択中の LLM は画像入力に対応していません。」）が UX 上わかりやすく表示され、生成が始まらない。
- [ ] `LOCALLLM_VISION=true`（vision 対応モデル想定）に変更すると Local でも画像送信が通る。

### 6.4 認可

- [ ] 他ユーザー所有の image id を直接 API に渡すと 404（フロント UI では自分の画像のみ選択可）。

## 7. PRJ-17 完了条件 8 項目の充足確認（このタスクで埋める表）

| # | PRJ-17 完了条件 | 充足手段 | 状態 |
| --- | --- | --- | --- |
| 1 | 既存ライブラリ画像を選び添付・送信できる | §6.2 / tsk-125 | 実機確認 |
| 2 | Claude/Gemini/OpenAI で画像認識応答 | §6.2 | 実機確認 |
| 3 | vision 非対応に画像送信→送信前 block | §6.3 / unit | unit 済 + 実機確認 |
| 4 | 添付がメッセージに紐付き永続化・履歴表示 | §6.2 / migration / unit | unit 済 + 実機確認 |
| 5 | 会話継続で過去添付も再送され文脈維持 | §6.2 / §5 unit | unit 済 + 実機確認 |
| 6 | 複数枚（上限内）添付できる | §6.2 / `MAX_ATTACHMENTS=5` | unit 済 + 実機確認 |
| 7 | 添付・送信は所有者本人に限定（認可） | §6.4 / unit | unit 済 + 実機確認 |
| 8 | backend/frontend ビルド通過・application ユニットで主要フロー担保 | `pnpm build` / `pnpm test` | 済 |

## 8. 既存設計との差分

- 実装上の差分は tsk-122〜125 で確定済み。本タスクはコード変更を伴わない（テスト最小補完を除く）ドキュメント・検証フェーズ。

## 9. トランザクション境界

- コード変更なし（既存の addMessage / softDeleteThread のトランザクション境界は tsk-122 で確定済み・本タスクで変更しない）。

## 10. 未確定事項

なし。

## 11. 実装計画

（Phase 4 で追記する）
