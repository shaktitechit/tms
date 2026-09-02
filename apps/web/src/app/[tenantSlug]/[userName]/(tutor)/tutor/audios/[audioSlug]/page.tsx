'use client';

import { useParams } from 'next/navigation';
import { AudioManagePanel } from '@/components/AudioManagePanel';

export default function MemberAudioDetailPage() {
  const params = useParams<{ audioSlug: string }>();
  return <AudioManagePanel audioSlug={params.audioSlug} />;
}
