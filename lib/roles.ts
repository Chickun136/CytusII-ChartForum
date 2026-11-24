export const ROLES = ['MASTER', 'ADMIN', 'PLAYER'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  MASTER: 'Master',
  ADMIN: 'Admin',
  PLAYER: 'Player',
};

const ROLE_STYLES: Record<Role, { bg: string; fg: string }> = {
  MASTER: { bg: '#452E13', fg: '#FFC000' },
  ADMIN: { bg: '#002E1D', fg: '#00A96B' },
  PLAYER: { bg: '#330033', fg: '#FF33FF' },
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
