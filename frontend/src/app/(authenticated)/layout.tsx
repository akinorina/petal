'use client';

import Link from 'next/link';
import { TopBar } from '@/design-system/components/TopBar';
import { Popover } from '@/design-system/components/Popover';
import { Avatar } from '@/design-system/components/Avatar';
import { ListItem } from '@/design-system/components/ListItem';
import { useAuthenticatedLayout } from './use-authenticated-layout';

export default function AuthenticatedLayout({
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
    navigate,
  } = useAuthenticatedLayout();

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const navItems = [
    { href: '/images', label: '画像' },
    { href: '/audios', label: '音声' },
    { href: '/chat', label: 'チャット' },
    ...(role === 'admin'
      ? [
          { href: '/users', label: 'ユーザー' },
          { href: '/audit-logs', label: '監査ログ' },
        ]
      : []),
  ];
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        className="admin-topbar shrink-0"
        start={
          <div className="flex items-center gap-3 sm:gap-6">
            {/* モバイル: ナビをハンバーガーメニュー（Popover）に集約 */}
            <div className="sm:hidden">
              <Popover placement="bottom-start">
                <Popover.Trigger>
                  <button
                    type="button"
                    aria-label="メニュー"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100"
                  >
                    <MenuIcon />
                  </button>
                </Popover.Trigger>
                <Popover.Content className="p-0" aria-label="ナビゲーション">
                  {navItems.map((item) => (
                    <Popover.Close key={item.href}>
                      <ListItem
                        as="button"
                        size="sm"
                        title={item.label}
                        isSelected={isActive(item.href)}
                        onClick={() => navigate(item.href)}
                      />
                    </Popover.Close>
                  ))}
                </Popover.Content>
              </Popover>
            </div>
            <span className="text-sm font-semibold">Petal</span>
            {/* デスクトップ: インラインナビ（狭幅では隠す） */}
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  active={isActive(item.href)}
                >
                  {item.label}
                </NavLink>
              ))}
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
      <main className="mx-auto w-full max-w-5xl flex-1 min-h-0 overflow-y-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
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
