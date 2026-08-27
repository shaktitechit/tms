'use client';

import { useParams } from 'next/navigation';
import { ModuleDetailPanel } from '@/components/ModuleDetailPanel';

export default function MemberModuleDetailPage() {
  const params = useParams<{ tenantSlug: string; userName: string; module_slug: string }>();
  const base = `/${params.tenantSlug}/${params.userName}`;

  return (
    <ModuleDetailPanel
      moduleSlug={params.module_slug}
      videosHref={`${base}/videos`}
      videosRole="user"
    />
  );
}
