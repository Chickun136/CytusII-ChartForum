import { difficultyStyle } from '@/lib/difficulty';

export function DifficultyBadge({
  name,
  level,
  className = '',
}: {
  name: string;
  level?: string | null;
  className?: string;
}) {
  const style = difficultyStyle(name);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide ${className}`}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {name}
      {level ? ` ${level}` : ''}
    </span>
  );
}
