import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AudioService } from '../../audio/application/audio.service';
import type { AudioMimeType } from '../../audio/domain/audio';
import type { ImageMimeType } from '../../image/domain/image';
import { ImageService } from '../../image/application/image.service';
import type { User } from '../../user/domain/user';
import type {
  ChatMessageAudioRef,
  ChatMessageImageRef,
} from '../domain/chat-message';
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

// 履歴応答の添付音声 view（署名付き表示 URL＋メタ・画像 view と対称・TSK-131）。
export type ChatMessageAudioAttachmentView = {
  audioId: string;
  position: number;
  mimeType: AudioMimeType;
  originalFilename: string;
  downloadUrl: string;
  expiresInSeconds: number;
};

// チャットの添付（画像・音声）解決（所有者認可・base64 化・表示 view 化）。
// ImageService / AudioService に依存し S3 取得・presign を委譲する。
@Injectable()
export class ChatAttachmentService {
  constructor(
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
  ) {}

  // 送信前検証。vision/audio チェック（I/O なし）を先に行い fail fast、
  // 続けて各画像／音声 id の所有者認可（非所有/不在は NotFound=404 が伝播）。
  async assertAttachmentsSendable(
    currentUser: User,
    imageIds: string[],
    audioIds: string[],
    supportsVision: boolean,
    supportsAudio: boolean,
  ): Promise<void> {
    if (imageIds.length === 0 && audioIds.length === 0) return;
    if (imageIds.length > 0 && !supportsVision) {
      throw new HttpException(
        {
          code: 'LLM_VISION_UNSUPPORTED',
          message: '選択中の LLM は画像入力に対応していません。',
          retryable: false,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (audioIds.length > 0 && !supportsAudio) {
      throw new HttpException(
        {
          code: 'LLM_AUDIO_UNSUPPORTED',
          message: '選択中の LLM は音声入力に対応していません。',
          retryable: false,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    for (const id of imageIds) {
      await this.imageService.findOneForOwner(currentUser, id);
    }
    for (const id of audioIds) {
      await this.audioService.findOneForOwner(currentUser, id);
    }
  }

  // メッセージ content を LLM 入力へ変換。添付無→文字列、
  // 添付有→先頭 text part＋position 昇順の image part＋position 昇順の audio part。
  async toLlmContent(
    currentUser: User,
    content: string,
    imageAttachments: ChatMessageImageRef[],
    audioAttachments: ChatMessageAudioRef[],
  ): Promise<string | ChatContentPart[]> {
    if (imageAttachments.length === 0 && audioAttachments.length === 0) {
      return content;
    }
    const orderedImages = [...imageAttachments].sort(
      (a, b) => a.position - b.position,
    );
    const orderedAudios = [...audioAttachments].sort(
      (a, b) => a.position - b.position,
    );
    const parts: ChatContentPart[] = [{ type: 'text', text: content }];
    for (const attachment of orderedImages) {
      const { mediaType, data } = await this.imageService.getOwnedImageBase64(
        currentUser,
        attachment.imageId,
      );
      parts.push({ type: 'image', mediaType, data });
    }
    for (const attachment of orderedAudios) {
      const { mediaType, data } = await this.audioService.getOwnedAudioBase64(
        currentUser,
        attachment.audioId,
      );
      parts.push({ type: 'audio', mediaType, data });
    }
    return parts;
  }

  // 画像添付を表示用 view（position 昇順）へ変換する。
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

  // 音声添付を表示用 view（position 昇順）へ変換する（画像と対称・TSK-131）。
  async toAudioAttachmentViews(
    currentUser: User,
    attachments: ChatMessageAudioRef[],
  ): Promise<ChatMessageAudioAttachmentView[]> {
    const ordered = [...attachments].sort((a, b) => a.position - b.position);
    const views: ChatMessageAudioAttachmentView[] = [];
    for (const attachment of ordered) {
      const view = await this.audioService.getOwnedAudioView(
        currentUser,
        attachment.audioId,
      );
      views.push({ ...view, position: attachment.position });
    }
    return views;
  }
}
