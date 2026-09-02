'use client';

import { useParams, usePathname } from 'next/navigation';
import {
  memberLayerFromSegment,
  memberWorkspaceBase,
  type MemberLayer,
} from '@/lib/roles';

/** Current member branch from the URL: /{tenant}/{username}/{learner|tutor}/… */
export function useMemberWorkspace(): {
  tenantSlug: string;
  userName: string;
  layer: MemberLayer;
  base: string;
} {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const layer = memberLayerFromSegment(parts[2]) ?? 'learner';
  return {
    tenantSlug: params.tenantSlug,
    userName: params.userName,
    layer,
    base: memberWorkspaceBase(params.tenantSlug, params.userName, layer),
  };
}
