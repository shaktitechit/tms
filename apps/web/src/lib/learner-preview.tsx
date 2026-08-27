'use client';

import { createContext, useContext } from 'react';
import { useAuth } from '@/lib/auth';
import { canManageCurriculum } from '@/lib/roles';

const LearnerPreviewContext = createContext(false);

/** Lets tenant admins and tutors preview a lesson as a learner. */
export function LearnerPreviewProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <LearnerPreviewContext.Provider value={enabled}>
      {children}
    </LearnerPreviewContext.Provider>
  );
}

export function useLearnerPreview(): boolean {
  return useContext(LearnerPreviewContext);
}

/** Curriculum-management UI is hidden while learner preview is on. */
export function useCanManageCurriculum(): boolean {
  const { user } = useAuth();
  const learnerPreview = useLearnerPreview();
  return canManageCurriculum(user) && !learnerPreview;
}
