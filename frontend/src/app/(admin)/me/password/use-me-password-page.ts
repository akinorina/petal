'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, authApi } from '@/lib/api';
import { setAuthNotice } from '@/lib/auth-session';
import { useAuth } from '@/contexts/AuthContext';
import { evaluatePasswordForm } from '@/lib/password-policy';

export function useMePasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordCheck = evaluatePasswordForm(newPassword, confirmPassword);
  const canSubmit =
    currentPassword.trim() !== '' && passwordCheck.canSubmit && !isSubmitting;

  const submit = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.changePassword({
        previousPassword: currentPassword,
        proposedPassword: newPassword,
      });
      // 成功するとバックエンドが全セッションを失効させるため、
      // ローカルのセッションもクリアして再ログインへ誘導する。
      setAuthNotice('パスワードを変更しました。再度ログインしてください。');
      await logout();
      router.replace('/login');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'パスワード変更に失敗しました',
      );
      setIsSubmitting(false);
    }
  }, [currentPassword, newPassword, logout, router]);

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isSubmitting,
    error,
    passwordCheck,
    canSubmit,
    submit,
  };
}
