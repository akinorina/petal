# TSK-133 音声分析の実機検証と仕様反映（設計書）

- Notion: <https://app.notion.com/p/3889ca7d99dc81ab87e1d862bbd35bf5>
- プロジェクト: PRJ-18（Petal LLM音声対応）<https://app.notion.com/p/3819ca7d99dc80bebbd8ed9118b7703f>
- 規模: M / 重要度: MIDDLE
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/10_audio-management.md](20_features/10_audio-management.md) / [docs/tsk-131_chat-audio-backend.md](tsk-131_chat-audio-backend.md) / [docs/tsk-132_chat-audio-frontend.md](tsk-132_chat-audio-frontend.md)

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

ネイティブ音声対応プロバイダ 1 つを確定し、音声添付→LLM 分析応答を end-to-end で実機検証し、docs に音声仕様を反映する。

### 背景・動機

PRJ-18 の完了条件「少なくとも 1 つのネイティブ対応プロバイダで音声分析が実際に動く」を満たす検証タスク。TSK-130〜132（音声ライブラリ連携・バックエンド送信・フロント UI）は実装・マージ済み。本タスクで実機動作を確認し、コードに散在する音声仕様を docs に集約する。

### 完了条件

- [ ] 検証対象プロバイダを確定する（本タスクでは **Gemini**。音声対応の Local モデルが入手できなかったため変更）。
- [ ] 音声をアップロード→チャットで添付→送信し、その音声内容に基づく LLM 応答が実機で得られることを確認する。
- [ ] 音声非対応 provider 選択時に 422 fail-fast し UI が専用文言を表示することを確認する。
- [ ] `docs/20_features/09_chat.md`（マルチモーダル）と `docs/20_features/10_audio-management.md`（音声管理）に音声添付の節を追記する。

### スコープ外

- 機能実装そのもの（TSK-130〜132・実装済み）。コード変更は原則なし（docs のみ）。

### 制約

- 検証プロバイダの API キー／モデル準備が前提（LM Studio に audio 対応モデル）。
- 実機検証は**ユーザーが実行し結果を共有**、AI はチェックリスト整備と docs 反映を担う。

### 不明点・迷い

解決済み（検証 provider＝Local の音声対応モデル／検証はユーザー実行・結果共有。Phase 3 で確定）。

## 2. スコープ

### 対象

- 実機検証（下記チェックリストをユーザーが実行）。
- docs 反映: `09_chat.md`・`10_audio-management.md` への音声節追記。

### 対象外

- バック／フロントのコード変更（既存実装で完結。検証で不具合が出た場合は別途課題化）。

## 3. 設計判断ログ

### 判断 1: 検証 provider は Gemini（採用・当初 Local から変更）

- **採用**: `LLM_PROVIDER=gemini` で検証する（`GEMINI_API_KEY` 設定済み・`supportsAudio()=true` 固定、inlineData で音声をネイティブ受付）。
- **理由**: 当初は Local の音声対応モデルを予定したが、LM Studio に `input_audio` 対応モデルが入手できなかった（gemma は vision のみで `input_audio` を拒否することを確認済み）。Gemini は追加準備なく確実に音声入力を受けられ、最低 1 provider で動けば PRJ 完了条件を満たす。
- 補足: provider 別 mapping は実装済みのため、Gemini で動けば他 provider（OpenAI/Local）は対応モデル用意時に同経路で動く想定。

### 判断 2: 形式は wav / mp3 を主対象に検証（採用）

- **採用**: OpenAI 互換の `input_audio.format` は本来 `wav`/`mp3` 想定のため、ローカル検証も wav/mp3 を主対象とする。録音由来の webm/mp4 は「多くのローカル実装が非対応」の可能性を確認・記録する。
- **理由**: バック実装（判断 3・TSK-131）は形式を変換せず通すだけで、適合は実機依存。本タスクで「動く形式」を確定し docs に注記する。

## 4. 実機検証チェックリスト（ユーザー実行）

### 前提

- `backend/.env`: `LLM_PROVIDER=gemini` / `GEMINI_API_KEY=<設定済み>` / `GEMINI_MODEL=<音声入力対応の Gemini モデル>`。
- backend（`pnpm start:dev`・3000 を 1 つだけ）と frontend を起動。
- Gemini は `supportsAudio()=true` 固定なので追加フラグ不要。inlineData は wav/mp3/ogg/flac/aac 等を受ける（webm/mp4 は要検証）。

### 検証 A（正常系・音声分析）

1. `/audios` で **wav または mp3** をアップロード。
2. チャットで音声を添付し、「この音声の内容を説明して」等を送信。
3. **期待**: 音声内容に基づく応答が返る（無音/別音声なら内容が一致する応答）。
4. **記録**: 使用モデル名・添付形式・応答の要旨。

### 検証 B（形式適合）

1. 録音由来（webm/mp4）の音声を添付して送信。
2. **記録**: 受理されたか／`input_audio` 拒否エラーが出たか。動く形式の範囲を確定。

### 検証 C（音声非対応 provider の 422）

1. 音声非対応 provider に切り替えて backend 再起動: `LLM_PROVIDER=claude`（Claude は `supportsAudio=false` 固定）、
   または `LLM_PROVIDER=local` のまま `LOCALLLM_AUDIO=false`。
2. 音声を添付して送信。
3. **期待**: 送信前 422 `LLM_AUDIO_UNSUPPORTED`、UI に「現在のモデルは音声に対応していません。…」と表示。添付は保持される。
4. **記録**: 422 と UI 文言が出たか。

### 結果記録欄（検証後に追記）

- 検証日 / 確定モデル / 動作した形式 / 応答例 / 422 確認 → 本設計書 §7 と `09_chat.md` の動作確認注記に反映。

## 5. docs 反映計画

### `docs/20_features/09_chat.md`（画像記述に音声を対称追記）

- 冒頭の原典リンクに tsk-130〜133 を追加。
- DB スキーマに `petal.chat_message_audios`（message_id / audio_id / position・migration 1746144009000）を追記し、`ChatMessage.audioAttachments: ChatMessageAudioRef[]` を明記。
- 「マルチモーダルメッセージ」節に audio part（`{ type:'audio', mediaType, data }`）・`hasAudioContent`・`getOwnedAudioBase64`/`getOwnedAudioView` 経路・**supportsAudio 表**（Claude=false 固定／Gemini=true 固定／OpenAI=env `OPENAI_AUDIO` 既定 false／LocalLLM=env `LOCALLLM_AUDIO` 既定 false）・音声上限（`MAX_AUDIO_ATTACHMENTS=3`）を追記。
- API 節に `attachmentAudioIds`（最大 3）と `audioAttachments`（`ChatMessageAudioAttachmentDto`）を追記。
- 送信フロー節に音声の pre-stream 検証を追記。
- エラー分類表に `LLM_AUDIO_UNSUPPORTED`（false / 422）行を追加。
- 環境変数表に `OPENAI_AUDIO` / `LOCALLLM_AUDIO` を追加。
- 形式適合の注記（OpenAI 互換 `input_audio` は wav/mp3 が確実、webm/mp4 は実装依存）を実機結果に基づき追記。

### `docs/20_features/10_audio-management.md`（チャット添付節）

- 「チャット添付（マルチモーダル）」節を追記: 所有音声を最大 3 件まで音声対応 provider へ base64 で送信、履歴は署名付き再生 URL。詳細は 09_chat.md 参照（画像の 04_image-management.md と対称）。

## 6. 既存設計との差分

- コード変更なし。docs を実装の現状（TSK-130〜132）に追従させ、実機検証で「動く provider/形式」を確定して注記する。

## 7. 完了条件（具体化版）／動作確認結果

- [ ] 検証 A/B/C をユーザーが実行し結果を本節へ記録。
- [ ] 09_chat.md・10_audio-management.md の音声節追記。
- [ ] `verify.sh all`（markdownlint 含む）が通る。

（検証結果は実施後にここへ追記する。）

## 8. 未確定事項

- 確定モデル名・動作形式は実機検証の結果で確定（検証後に記録）。

## 9. 実装計画

### 変更・追加ファイル

- 変更: `docs/20_features/09_chat.md`（§5 の各節へ音声を対称追記）
- 変更: `docs/20_features/10_audio-management.md`（「チャット添付（マルチモーダル）」節を追記）
- 変更: `docs/tsk-133_chat-audio-finishing.md`（§7 へ実機検証結果を記録）
- コード変更・migration・環境変数・依存追加: なし

### 作業順序（コミット単位 + 完了確認）

1. **実機検証**（ユーザー実行）: §4 の検証 A/B/C を実施し結果を共有。
2. `docs(tsk-133): チャット仕様に音声添付を反映` — `09_chat.md`（原典リンク・DB スキーマ `chat_message_audios`・マルチモーダル節の audio part / `hasAudioContent` / base64 経路 / supportsAudio 表 / 上限 3 / API `attachmentAudioIds`・`audioAttachments` / 送信フロー / エラー分類 `LLM_AUDIO_UNSUPPORTED` / 環境変数 `OPENAI_AUDIO`・`LOCALLLM_AUDIO` / 形式適合注記）と `10_audio-management.md`（チャット添付節）を追記。確認: 記述がコード現状（TSK-130〜132）と一致。
3. `docs(tsk-133): 音声分析の実機検証結果を記録` — 設計書 §7 に検証 A/B/C の結果（確定モデル・動作形式・応答例・422 確認）を記録。
4. 仕上げ: `bash .claude/skills/skill-workflow/scripts/verify.sh all`（markdownlint 含む）が緑。

（コミット 2 の docs 本文はコード由来の確定事実なので検証完了前に着手可能。形式適合の注記のみ検証 B の結果に合わせて確定する。）

### テスト方針

- ドキュメントのみ。`verify.sh all` の markdownlint で構文を担保。記述内容はコード（merged）と照合してレビュー。

### 想定外時の判断ルール

- **AI 単独判断 OK**: docs の文言・構成調整、コード現状に合わせた記述修正。
- **中断して要相談**: 実機検証でコードのバグ（422 が出ない・所有者認可漏れ・応答が音声に基づかない等）が判明した場合（docs では吸収せず別タスク化を相談）。設計判断（判断 1/2）を覆す必要が出た場合。

### 事前解決済みの判断ポイント

- 検証 provider＝Local の音声対応モデル（判断 1）／主対象形式＝wav・mp3（判断 2）。
- 反映先は現行 `docs/20_features/`（課題シートの `docs/specs/` は旧アーカイブ位置）。
- docs 本文は画像記述への対称追記で確定。検証依存は「形式適合の注記」と「§7 結果記録」のみ。
- 規模は docs 中心の M。Phase 5 はサブエージェントではなくフォアグラウンドで実施（検証結果の反映と判断を伴うため）。
