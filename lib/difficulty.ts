export const DIFFICULTY_STYLES: Record<string, { bg: string; fg: string }> = {
  EASY: { bg: '#003366', fg: '#33CCFF' },
  HARD: { bg: '#330000', fg: '#FF3333' },
  CHAOS: { bg: '#330033', fg: '#FF33FF' },
  GLITCH: { bg: '#002E1D', fg: '#00A96B' },
  CRASH: { bg: '#452E13', fg: '#FFC000' },
  DREAM: { bg: '#6E6E6E', fg: '#FFFFFF' },
  DROP: { bg: '#EFEFEF', fg: '#6E6E6E' },
  UNKNOWN: { bg: '#000000', fg: '#FFFFFF' },
};

export function difficultyStyle(name: string) {
  return DIFFICULTY_STYLES[name] ?? DIFFICULTY_STYLES.UNKNOWN;
}
