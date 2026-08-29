'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AudioUploadForm } from '@/components/AudioUploadForm';
import { VideoUploadForm } from '@/components/VideoUploadForm';
import { MemberAccessGate } from '@/components/portals/member/MemberAccess';

type UploadTab = 'video' | 'audio';

function TutorUploadUnavailable() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Upload not available</h1>
      <p className="text-slate-500">
        Learner accounts can browse assigned departments and live sessions. Only tutors can upload
        to the library.
      </p>
    </div>
  );
}

function TutorUploadForms() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const [tab, setTab] = useState<UploadTab>('video');
  const base = `/${params.tenantSlug}/${params.userName}`;

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
        <VideoUploadForm detailHref={(slug) => `${base}/videos/${slug}`} />
      ) : (
        <AudioUploadForm detailHref={(slug) => `${base}/audios/${slug}`} />
      )}
    </div>
  );
}

export function MemberUploadPortal() {
  return (
    <MemberAccessGate access="tutor" fallback={<TutorUploadUnavailable />}>
      <TutorUploadForms />
    </MemberAccessGate>
  );
}
