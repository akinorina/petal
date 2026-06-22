'use client';

import NextLink from 'next/link';
import { Button } from '@/design-system/components/Button';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import type { Schemas } from '@/lib/openapi/client';
import { ImageThumb } from './ImageThumb';
import { MAX_ATTACHMENTS } from './use-image-attachment';

type ImageItem = Schemas['ImageResponseDto'];

type ImageAttachmentPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageItem[];
  isLoading: boolean;
  error: string | null;
  /** 選択中 id（Dialog 内のトグル状態と一致）。 */
  selectedIds: string[];
  canAddMore: boolean;
  onToggle: (id: string) => void;
};

/**
 * ライブラリ画像の選択 Dialog（D1）。グリッドで複数トグルし「追加」で確定する。
 * 上限（MAX_ATTACHMENTS）到達時は未選択分の選択を抑制し、ライブラリ 0 件時は
 * EmptyState ＋ /images（画像管理）への導線を表示する（その場アップロードは範囲外）。
 */
export function ImageAttachmentPicker({
  open,
  onOpenChange,
  images,
  isLoading,
  error,
  selectedIds,
  canAddMore,
  onToggle,
}: ImageAttachmentPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>画像を選択</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {isLoading ? (
            <p className="text-sm text-zinc-500">読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : images.length === 0 ? (
            <EmptyState
              title="画像はまだありません"
              description="先に画像管理ページで画像をアップロードしてください。"
              primaryAction={
                <NextLink href="/images" className="ds-link ds-link--inline text-sm">
                  画像管理へ
                </NextLink>
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-zinc-500">
                最大 {MAX_ATTACHMENTS} 枚まで選択できます（選択済み {selectedIds.length} 枚）。
              </p>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((image) => {
                  const isSelected = selectedIds.includes(image.id);
                  // 未選択かつ上限到達時は新規選択を抑制する。
                  const isDisabled = !isSelected && !canAddMore;
                  const label = image.title || image.originalFilename;
                  return (
                    <li key={image.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(image.id)}
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                        aria-label={`${label} を${isSelected ? '選択解除' : '選択'}`}
                        className={[
                          'group relative block w-full overflow-hidden rounded-md border-2 transition-colors',
                          isSelected ? 'border-blue-500' : 'border-zinc-200',
                          isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:border-blue-300',
                        ].join(' ')}
                      >
                        <div className="relative aspect-square bg-zinc-100">
                          <ImageThumb imageId={image.id} alt={label} />
                          {isSelected && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" onClick={() => onOpenChange(false)}>
            追加（{selectedIds.length}）
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
