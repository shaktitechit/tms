'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMemberAccess } from '@/components/portals/member/MemberAccess';
import { dashboardHome } from '@/lib/roles';

/** /{tenant}/{username} → /{tenant}/{username}/learner or /tutor */
export default function MemberRootRedirectPage() {
  const router = useRouter();
  const { user, loading } = useMemberAccess();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(dashboardHome(user));
  }, [loading, router, user]);

  return <p className="text-slate-500">Loading…</p>;
}
