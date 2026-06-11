'use client';

import Link from 'next/link';
import { TopBar } from '@/design-system/components/TopBar';
import { Popover } from '@/design-system/components/Popover';
import { Avatar } from '@/design-system/components/Avatar';
import { ListItem } from '@/design-system/components/ListItem';
import { useAdminLayout } from './use-admin-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    pathname,
    email,
    role,
    isAuthenticated,
    isLoading,
    handleLogout,
    goToProfile,
  } = useAdminLayout();

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
        className="admin-topbar"
        start={
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold">Petal</span>
            <nav className="flex items-center gap-4 text-sm">
              <NavLink href="/images" active={pathname.startsWith('/images')}>
                画像
              </NavLink>
              <NavLink href="/chat" active={pathname.startsWith('/chat')}>
                チャット
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
          <div className="ml-auto">
            <Popover placement="bottom-end">
              <Popover.Trigger>
                <button
                  type="button"
                  aria-label="アカウントメニュー"
                  className="flex items-center rounded-full"
                >
                  <Avatar size="sm" alt="" />
                </button>
              </Popover.Trigger>
              <Popover.Content className="p-0" aria-label="アカウントメニュー">
                <div className="max-w-[240px] truncate border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-zinc-500">
                  {email}
                </div>
                <Popover.Close>
                  <ListItem
                    as="button"
                    size="sm"
                    title="プロフィール"
                    onClick={goToProfile}
                  />
                </Popover.Close>
                <Popover.Close>
                  <ListItem
                    as="button"
                    size="sm"
                    title="ログアウト"
                    onClick={handleLogout}
                  />
                </Popover.Close>
              </Popover.Content>
            </Popover>
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
