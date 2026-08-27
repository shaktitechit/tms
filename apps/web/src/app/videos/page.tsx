'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { videosPath } from '@/lib/roles';

export default function VideosRedirectPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    window.location.replace(user ? videosPath(user) : '/login');
  }, [loading, user]);

  return <p className="text-slate-500">Redirecting…</p>;
}
