'use client';

import { useEffect } from 'react';
import {
  AuthCard,
  Field,
  inputClassName,
  primaryButtonClassName,
} from '@/components/portals/shared/AuthCard';
import { useToast } from '@/components/Toaster';

const toastedAuthErrors = new Set<string>();

export function AuthCredentialsForm({
  intent,
  submitLabel,
  error,
  children,
  footer,
  eyebrow,
  title,
  description,
}: {
  intent: string;
  submitLabel: string;
  error?: string | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  const toast = useToast();

  useEffect(() => {
    if (!error || toastedAuthErrors.has(error)) {
      return;
    }
    toastedAuthErrors.add(error);
    toast.error(error);
  }, [error, toast]);

  return (
    <AuthCard eyebrow={eyebrow} title={title} description={description} footer={footer}>
      <form action="/api/auth/session" method="post" className="space-y-4">
        <input type="hidden" name="intent" value={intent} />
        {children}
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={inputClassName}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            name="password"
            required
            autoComplete={intent === 'register' ? 'new-password' : 'current-password'}
            minLength={intent === 'register' ? 8 : undefined}
            className={inputClassName}
          />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" className={primaryButtonClassName}>
          {submitLabel}
        </button>
      </form>
    </AuthCard>
  );
}
