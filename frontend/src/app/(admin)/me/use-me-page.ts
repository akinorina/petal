'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useMeApi } from '@/lib/api-hooks/use-me-api';

export function useMePage() {
  const { me, isLoading, error, setError, updateProfile } = useMeApi();
  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 取得した自分のプロフィールでフォーム初期値を一度だけ埋める。
  useEffect(() => {
    if (!me || seeded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(me.name);
    setNameKana(me.nameKana);
    setSeeded(true);
  }, [me, seeded]);

  const submit = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const updated = await updateProfile({ name, nameKana });
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
  }, [name, nameKana, updateProfile, setError]);

  const canSubmit =
    !isLoading && name.trim() !== '' && nameKana.trim() !== '' && !isSubmitting;

  return {
    email: me?.email ?? null,
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
