'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AudioUploadForm } from '@/components/AudioUploadForm';
import { VideoUploadForm } from '@/components/VideoUploadForm';
import { useAuth } from '@/lib/auth';
import { uploadPath } from '@/lib/roles';

type UploadTab = 'video' | 'audio';

export function TenantUploadPortal() {
  const params = useParams<{ tenantSlug?: string }>();
  const { user, loading } = useAuth();
  const tenantSlug = params.tenantSlug;
  const [tab, setTab] = useState<UploadTab>('video');

  useEffect(() => {
    if (loading || tenantSlug) {
      return;
    }
    window.location.replace(user ? uploadPath(user) : '/login');
  }, [loading, user, tenantSlug]);

  if (!tenantSlug) {
    return <p className="text-slate-500">Redirecting…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-3xl gap-2 rounded-full border border-blue-100 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab('video')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === 'video' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Video
        </button>
        <button
          type="button"
          onClick={() => setTab('audio')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === 'audio' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Audio
        </button>
      </div>

      {tab === 'video' ? (
        <VideoUploadForm detailHref={(slug) => `/${tenantSlug}/videos/${slug}`} />
      ) : (
        <AudioUploadForm detailHref={(slug) => `/${tenantSlug}/audios/${slug}`} />
      )}
    </div>
  );
}
