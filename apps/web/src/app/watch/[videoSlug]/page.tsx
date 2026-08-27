'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { watchPath } from '@/lib/roles';

/** Legacy /watch/:slug → workspace dashboard watch route. */
export default function WatchRedirectPage() {
  const params = useParams<{ videoSlug: string }>();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      window.location.replace('/login');
      return;
    }
    window.location.replace(watchPath(user, params.videoSlug));
  }, [loading, user, params.videoSlug]);

  return <p className="text-slate-500">Opening player…</p>;
}
