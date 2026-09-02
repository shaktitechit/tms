import { forbidden } from './errors.js';

export type CurriculumActor = {
  role: string;
  access?: string | null;
};

export function isTutorActor(actor: CurriculumActor): boolean {
  return (
    String(actor.role ?? '').toLowerCase() === 'user' &&
    String(actor.access ?? '').toLowerCase() === 'tutor'
  );
}

export function canManageCurriculum(actor: CurriculumActor): boolean {
  return String(actor.role ?? '').toLowerCase() === 'tenant' || isTutorActor(actor);
}

/** Members who must complete lessons in order. Tenant admins and tutors are not gated. */
export function isLearnerActor(actor: CurriculumActor): boolean {
  return !canManageCurriculum(actor);
}

export function assertCanManageCurriculum(actor: CurriculumActor): void {
  if (!canManageCurriculum(actor)) {
    throw forbidden();
  }
}
