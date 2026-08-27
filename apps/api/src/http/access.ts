import { MemberAccess, UserRole } from '@video/shared';
import { forbidden } from './errors.js';

export type CurriculumActor = {
  role: string;
  access?: string | null;
};

export function isTutorActor(actor: CurriculumActor): boolean {
  return actor.role === UserRole.USER && actor.access === MemberAccess.TUTOR;
}

export function canManageCurriculum(actor: CurriculumActor): boolean {
  return actor.role === UserRole.TENANT || isTutorActor(actor);
}

export function assertCanManageCurriculum(actor: CurriculumActor): void {
  if (!canManageCurriculum(actor)) {
    throw forbidden();
  }
}
