'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { videoDetailPath } from '@/lib/roles';

/** Legacy /videos/:slug → workspace video detail. */
export default function VideoDetailRedirectPage() {
  const params = useParams<{ videoSlug: string }>();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !params.videoSlug) {
      return;
    }
    window.location.replace(user ? videoDetailPath(user, params.videoSlug) : '/login');
  }, [loading, user, params.videoSlug]);

  return <p className="text-slate-500">Redirecting…</p>;
}
