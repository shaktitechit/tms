'use client';

import { useParams } from 'next/navigation';
import { ModulesListView } from '@/components/ModulesListView';

export default function MemberModulesPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const base = `/${params.tenantSlug}/${params.userName}`;

  return (
    <ModulesListView detailHref={(module) => `${base}/modules/${module.slug}`} />
  );
}
