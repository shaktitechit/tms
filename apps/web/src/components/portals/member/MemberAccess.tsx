'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { dashboardHome, memberAccessValue, memberLayer, type MemberLayer } from '@/lib/roles';
import type { AuthUser } from '@/lib/types';
import { useGetUserQuery } from '@/store/api';

type MemberAccessState = {
  user: AuthUser | null;
  layer: MemberLayer | null;
  isTutor: boolean;
  isLearner: boolean;
  loading: boolean;
};

const MemberAccessContext = createContext<MemberAccessState | undefined>(undefined);

function isTutorAccess(access?: string | null): boolean {
  return memberAccessValue(access) === 'tutor';
}

/**
 * Access layer for member accounts (`role: user`).
 * Tutor wins if either the session or the member record says tutor.
 */
export function MemberAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { data, isError, isLoading, isFetching } = useGetUserQuery(user?.id ?? '', {
    skip: !user?.id,
  });

  const waitingForRecord =
    Boolean(user?.id) && !data && !isError && (isLoading || isFetching);
  const loading = authLoading || waitingForRecord;

  const tutor = isTutorAccess(user?.access) || isTutorAccess(data?.user.access);
  const layer: MemberLayer | null = user
    ? tutor
      ? 'tutor'
      : memberLayer(user) ?? 'learner'
    : null;

  const value = useMemo<MemberAccessState>(
    () => ({
      user,
      layer,
      isTutor: tutor,
      isLearner: Boolean(user) && !tutor,
      loading,
    }),
    [user, layer, tutor, loading],
  );

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <MemberAccessContext.Provider value={value}>{children}</MemberAccessContext.Provider>
  );
}

export function useMemberAccess(): MemberAccessState {
  const context = useContext(MemberAccessContext);
  if (!context) {
    throw new Error('useMemberAccess must be used within MemberAccessProvider');
  }
  return context;
}

/** Gate a page or block to one member access layer (tutor or learner). */
export function MemberAccessGate({
  access,
  children,
  fallback,
}: {
  access: MemberLayer;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { loading, layer } = useMemberAccess();

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (layer !== access) {
    return (
      <>
        {fallback ?? (
          <p className="text-slate-500">
            This page is for {access} accounts.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}

function MemberHomeRedirect() {
  const { user } = useMemberAccess();
  const router = useRouter();
  const href = dashboardHome(user);

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <p className="text-slate-500">Redirecting…</p>;
}

/** Layout gate for the `(tutor)` or `(learner)` member branch. */
export function MemberBranchLayout({
  access,
  children,
}: {
  access: MemberLayer;
  children: React.ReactNode;
}) {
  return (
    <MemberAccessGate access={access} fallback={<MemberHomeRedirect />}>
      {children}
    </MemberAccessGate>
  );
}
