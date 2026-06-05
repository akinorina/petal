import Link from 'next/link';
import { EmptyState } from '@/design-system/components/EmptyState';

export function Forbidden403() {
  return (
    <EmptyState
      title="アクセス権限がありません"
      description="このページを表示する権限がありません。"
      primaryAction={
        <Link href="/images" className="ds-link ds-link--inline text-sm">
          トップ（画像）へ戻る
        </Link>
      }
    />
  );
}
