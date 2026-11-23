export const ROLES = ['MASTER', 'ADMIN', 'PLAYER'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  MASTER: 'Master',
  ADMIN: 'Admin',
  PLAYER: 'Player',
};

const ROLE_STYLES: Record<Role, string> = {
  MASTER: 'border-amber-400/60 bg-amber-400/10 text-amber-200',
  ADMIN: 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200',
  PLAYER: 'border-zinc-700 bg-zinc-800/50 text-zinc-300',
};

export function isRole(value: string | null | undefined): value is Role {
  return value === 'MASTER' || value === 'ADMIN' || value === 'PLAYER';
}

export function roleLabel(role: string) {
  return isRole(role) ? ROLE_LABELS[role] : role;
}

export function roleStyle(role: string) {
  return isRole(role) ? ROLE_STYLES[role] : ROLE_STYLES.PLAYER;
}

export function canAccessAdmin(role: string | null | undefined) {
  return role === 'MASTER' || role === 'ADMIN';
}

export function isMaster(role: string | null | undefined) {
  return role === 'MASTER';
}
