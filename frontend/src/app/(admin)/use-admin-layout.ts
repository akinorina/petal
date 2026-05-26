'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function useAdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, email, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return {
    pathname,
    email,
    isAuthenticated,
    isLoading,
    handleLogout,
  };
}
