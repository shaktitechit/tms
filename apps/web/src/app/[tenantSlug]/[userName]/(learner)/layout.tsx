'use client';

import { MemberBranchLayout } from '@/components/portals/member/MemberAccess';

/** Learner-only workspace. Tutors are redirected to /tutor. */
export default function LearnerBranchLayout({ children }: { children: React.ReactNode }) {
  return <MemberBranchLayout access="learner">{children}</MemberBranchLayout>;
}
