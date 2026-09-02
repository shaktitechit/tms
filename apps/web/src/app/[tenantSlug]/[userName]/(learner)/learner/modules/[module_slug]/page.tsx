'use client';

import { useParams } from 'next/navigation';
import { ModuleDetailPanel } from '@/components/ModuleDetailPanel';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function MemberModuleDetailPage() {
  const { base } = useMemberWorkspace();
  const params = useParams<{ module_slug: string }>();

  return (
    <ModuleDetailPanel
      moduleSlug={params.module_slug}
      videosHref={`${base}/videos`}
      videosRole="user"
    />
  );
}
