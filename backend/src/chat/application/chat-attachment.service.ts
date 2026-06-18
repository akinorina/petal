import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { ImageMimeType } from '../../image/domain/image';
import { ImageService } from '../../image/application/image.service';
import type { User } from '../../user/domain/user';
import type { ChatMessageImageRef } from '../domain/chat-message';
import type { ChatContentPart } from '../domain/llm-message';

// 履歴応答の添付画像 view（署名付き表示 URL＋メタ）。
export type ChatMessageAttachmentView = {
  imageId: string;
  position: number;
  mimeType: ImageMimeType;
  originalFilename: string;
  downloadUrl: string;
  expiresInSeconds: number;
};

// チャットの添付画像解決（所有者認可・base64 化・表示 view 化）。
// ImageService に依存し S3 取得・presign を委譲する。
@Injectable()
export class ChatAttachmentService {
  constructor(private readonly imageService: ImageService) {}

  // 送信前検証。vision チェック（I/O なし）を先に行い fail fast、
  // 続けて各画像 id の所有者認可（非所有/不在は NotFound=404 が伝播）。
  async assertAttachmentsSendable(
    currentUser: User,
    imageIds: string[],
    supportsVision: boolean,
  ): Promise<void> {
    if (imageIds.length === 0) return;
    if (!supportsVision) {
      throw new HttpException(
        {
          code: 'LLM_VISION_UNSUPPORTED',
          message: '選択中の LLM は画像入力に対応していません。',
          retryable: false,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    for (const id of imageIds) {
      await this.imageService.findOneForOwner(currentUser, id);
    }
  }

  // メッセージ content を LLM 入力へ変換。添付無→文字列、
  // 添付有→先頭 text part＋position 昇順の image part（base64）。
  async toLlmContent(
    currentUser: User,
    content: string,
    attachments: ChatMessageImageRef[],
  ): Promise<string | ChatContentPart[]> {
    if (attachments.length === 0) return content;
    const ordered = [...attachments].sort((a, b) => a.position - b.position);
    const parts: ChatContentPart[] = [{ type: 'text', text: content }];
    for (const attachment of ordered) {
      const { mediaType, data } = await this.imageService.getOwnedImageBase64(
        currentUser,
        attachment.imageId,
      );
      parts.push({ type: 'image', mediaType, data });
    }
    return parts;
  }

  // 添付を表示用 view（position 昇順）へ変換する。
  async toAttachmentViews(
    currentUser: User,
    attachments: ChatMessageImageRef[],
  ): Promise<ChatMessageAttachmentView[]> {
    const ordered = [...attachments].sort((a, b) => a.position - b.position);
    const views: ChatMessageAttachmentView[] = [];
    for (const attachment of ordered) {
      const view = await this.imageService.getOwnedImageView(
        currentUser,
        attachment.imageId,
      );
      views.push({ ...view, position: attachment.position });
    }
    return views;
  }
}
