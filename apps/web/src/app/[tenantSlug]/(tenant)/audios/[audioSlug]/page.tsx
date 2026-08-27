'use client';

import { useParams } from 'next/navigation';
import { AudioManagePanel } from '@/components/AudioManagePanel';

export default function TenantAudioDetailPage() {
  const params = useParams<{ audioSlug: string }>();
  return <AudioManagePanel audioSlug={params.audioSlug} />;
}
