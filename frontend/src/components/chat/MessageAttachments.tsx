'use client';

import { useState } from 'react';
import { Dialog } from '@/design-system/components/Dialog';
import { ImageThumb } from './ImageThumb';

/**
 * バブル内に表示する添付の最小情報。
 * - サーバ確定メッセージ: `downloadUrl`（署名付き）を直接使う。
 * - 楽観バブル: `downloadUrl` 未取得のため `imageId` から取得する。
 */
export type DisplayAttachment = {
  imageId: string;
  /** 署名付き URL（履歴は持つ・楽観は持たない）。 */
  downloadUrl?: string;
  /** alt・原寸プレビューのラベル。 */
  label?: string;
};

type MessageAttachmentsProps = {
  attachments: DisplayAttachment[];
};

/**
 * ユーザーバブル内の添付サムネ列（D3）。クリックで Dialog 原寸プレビューを開く。
 * `downloadUrl` があれば直接表示し、なければ `imageId` から取得する（両対応）。
 */
export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [preview, setPreview] = useState<DisplayAttachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att) => {
          const label = att.label ?? '添付画像';
          return (
            <li key={att.imageId}>
              <button
                type="button"
                onClick={() => setPreview(att)}
                aria-label={`${label} を拡大表示`}
                className="block h-20 w-20 overflow-hidden rounded-md border border-border-default bg-surface-sunken"
              >
                <ImageThumb imageId={att.imageId} src={att.downloadUrl} alt={label} />
              </button>
            </li>
          );
        })}
      </ul>

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)} size="lg">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{preview.label ?? '添付画像'}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <div className="flex max-h-[70vh] justify-center overflow-auto">
                <ImageThumb
                  imageId={preview.imageId}
                  src={preview.downloadUrl}
                  alt={preview.label ?? '添付画像'}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog>
      )}
    </>
  );
}
