'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function useAdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, email, role, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function goToProfile() {
    router.push('/me');
  }

  return {
    pathname,
    email,
    role,
    isAuthenticated,
    isLoading,
    handleLogout,
    goToProfile,
  };
}
