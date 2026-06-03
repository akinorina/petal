'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, userApi } from '@/lib/api';

export function useMePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await userApi.findMe();
        if (!active) return;
        setEmail(me.email);
        setName(me.name);
        setNameKana(me.nameKana);
      } catch (e) {
        if (!active) return;
        setError(
          e instanceof ApiError ? e.message : 'プロフィールの取得に失敗しました',
        );
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const updated = await userApi.updateMyProfile({ name, nameKana });
      setName(updated.name);
      setNameKana(updated.nameKana);
      setSuccessMessage('プロフィールを更新しました');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'プロフィールの更新に失敗しました',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [name, nameKana]);

  const canSubmit =
    !isLoading && name.trim() !== '' && nameKana.trim() !== '' && !isSubmitting;

  return {
    email,
    name,
    setName,
    nameKana,
    setNameKana,
    isLoading,
    isSubmitting,
    error,
    successMessage,
    canSubmit,
    submit,
  };
}
