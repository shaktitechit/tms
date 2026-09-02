'use client';

import { ModulesListView } from '@/components/ModulesListView';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function MemberModulesPage() {
  const { base } = useMemberWorkspace();

  return (
    <ModulesListView detailHref={(module) => `${base}/modules/${module.slug}`} />
  );
}
