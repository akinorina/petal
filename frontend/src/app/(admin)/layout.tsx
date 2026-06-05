'use client';

import Link from 'next/link';
import { TopBar } from '@/design-system/components/TopBar';
import { useAdminLayout } from './use-admin-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname, email, role, isAuthenticated, isLoading, handleLogout } =
    useAdminLayout();

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-full">
      <TopBar
        start={
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold">Petal</span>
            <nav className="flex items-center gap-4 text-sm">
              <NavLink href="/images" active={pathname.startsWith('/images')}>
                画像
              </NavLink>
              {role === 'admin' && (
                <>
                  <NavLink href="/users" active={pathname.startsWith('/users')}>
                    ユーザー
                  </NavLink>
                  <NavLink
                    href="/audit-logs"
                    active={pathname.startsWith('/audit-logs')}
                  >
                    監査ログ
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        }
        end={
          <div className="flex items-center gap-4">
            <Link href="/me" className="ds-link ds-link--inline text-xs">
              {email}
            </Link>
            <button
              onClick={handleLogout}
              className="ds-link ds-link--inline text-xs"
            >
              ログアウト
            </button>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'font-medium text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-900'
      }
    >
      {children}
    </Link>
  );
}
