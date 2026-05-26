'use client';

import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useMeEmailApi } from '@/lib/api-hooks/use-me-email-api';
import { useAuth } from '@/contexts/AuthContext';

type Step =
  | { kind: 'request' }
  | { kind: 'confirm'; pendingEmail: string };

export function useMeEmailPage() {
  const { email, updateEmail } = useAuth();
  const api = useMeEmailApi();
  const [step, setStep] = useState<Step>({ kind: 'request' });
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submitRequest = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await api.requestEmailChange(newEmail);
      setStep({ kind: 'confirm', pendingEmail: newEmail });
      setCode('');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'メールアドレス変更要求に失敗しました',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [api, newEmail]);

  const submitConfirm = useCallback(async () => {
    if (step.kind !== 'confirm') return;
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await api.confirmEmailChange(code);
      updateEmail(step.pendingEmail);
      setSuccessMessage(
        `メールアドレスを ${step.pendingEmail} に変更しました`,
      );
      setStep({ kind: 'request' });
      setNewEmail('');
      setCode('');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'メールアドレス変更に失敗しました',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [api, code, step, updateEmail]);

  const cancelConfirm = useCallback(() => {
    setStep({ kind: 'request' });
    setCode('');
    setError(null);
  }, []);

  return {
    currentEmail: email,
    step,
    newEmail,
    setNewEmail,
    code,
    setCode,
    isSubmitting,
    error,
    successMessage,
    submitRequest,
    submitConfirm,
    cancelConfirm,
  };
}
