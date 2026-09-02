'use client';

import { MemberBranchLayout } from '@/components/portals/member/MemberAccess';

/** Tutor-only workspace. Learners are redirected to /learner. */
export default function TutorBranchLayout({ children }: { children: React.ReactNode }) {
  return <MemberBranchLayout access="tutor">{children}</MemberBranchLayout>;
}
