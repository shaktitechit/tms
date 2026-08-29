'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { getErrorMessage, useLogoutMutation, useMeQuery } from '@/store/api';
import type { AuthUser } from '@/lib/types';
import { dashboardHome, isLearner, isMemberUser, isTenantAdmin, isTutor } from '@/lib/roles';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isTenant: boolean;
  isUser: boolean;
  isTutor: boolean;
  isLearner: boolean;
  dashboardPath: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isFetching, refetch } = useMeQuery();
  const [logoutMutation] = useLogoutMutation();

  const user = data?.user ?? null;
  const loading = isLoading || (isFetching && !data);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Logout failed'));
    }
  }, [logoutMutation]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isTenant: isTenantAdmin(user),
      isUser: isMemberUser(user),
      isTutor: isTutor(user),
      isLearner: isLearner(user),
      dashboardPath: dashboardHome(user),
      refresh,
      logout,
    }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
