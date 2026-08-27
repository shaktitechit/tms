'use client';

import { useParams } from 'next/navigation';
import { MemberProgressView } from '@/components/MemberProgressView';

export default function TenantUserDetailPage() {
  const params = useParams<{ tenantSlug: string; userSlug: string }>();

  return <MemberProgressView tenantSlug={params.tenantSlug} userSlug={params.userSlug} />;
}
