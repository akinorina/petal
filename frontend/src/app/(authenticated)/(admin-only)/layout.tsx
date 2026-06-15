'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Forbidden403 } from './Forbidden403';

/**
 * admin 限定ルート（/users・/audit-logs）のガード。
 * 一般ユーザー（role !== 'admin'）には 403 ビューを表示する。
 * ローディング中は親 (authenticated)/layout が「読み込み中...」を表示しているため null を返す。
 */
export default function AdminOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useAuth();

  if (isLoading) return null;
  if (role !== 'admin') return <Forbidden403 />;

  return <>{children}</>;
}
