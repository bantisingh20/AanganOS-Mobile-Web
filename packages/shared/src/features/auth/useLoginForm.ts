import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/store/AuthContext';
import { ApiRequestError, toFormError, type FormErrorView } from '@shared/api/errors';
import type { LoginResponse } from '@shared/api/auth';

export const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };

export interface LoginFormOptions {
  /** Runs after a successful login, with the trimmed identifier and the password that were used. */
  onSuccess?: (result: LoginResponse, credentials: { identifier: string; password: string }) => void | Promise<void>;
  /** Runs after a failed login with the raw error view (before the "incorrect credentials" mapping). */
  onError?: (view: FormErrorView) => void;
}

/**
 * Login form state + submit, shared by the app LoginScreen and the admin LoginPage.
 * Wrong phone/password (UNAUTHENTICATED, not a lock-out) shows one friendly message;
 * every other error is shown as the API returned it.
 */
export function useLoginForm({ onSuccess, onError }: LoginFormOptions = {}) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(NO_ERROR);
    try {
      const id = identifier.trim();
      const result = await login({ identifier: id, password, platform: 'web' });
      await onSuccess?.(result, { identifier: id, password });
    } catch (err) {
      const view = toFormError(err);
      if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED' && !/lock/i.test(err.message)) {
        setError({ message: t('common.loginInvalidCredentials'), fieldErrors: view.fieldErrors });
      } else {
        setError(view);
      }
      onError?.(view);
    } finally {
      setSubmitting(false);
    }
  };

  return { identifier, setIdentifier, password, setPassword, submitting, error, submit };
}
