import { isMaster } from './roles';

export type ModerationActor = { id: string; role: string };

export function canDeleteComment(
  actor: ModerationActor | null,
  target: { userId: string; authorRole: string },
) {
  if (!actor) return false;
  if (actor.id === target.userId) return true;
  if (isMaster(actor.role)) return true;
  return actor.role === 'ADMIN' && target.authorRole === 'PLAYER';
}

export function canHandleReport(
  actorRole: string | null | undefined,
  authorRole: string,
) {
  if (actorRole === 'MASTER') return true;
  return actorRole === 'ADMIN' && authorRole === 'PLAYER';
}
