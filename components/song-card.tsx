import Link from 'next/link';
import type { SongWithCharts } from '@/lib/songs';
import { DifficultyBadge } from './difficulty-badge';

function highlight(text: string, query: string) {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-cyan-400/20 px-0.5 text-cyan-200">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function SongCard({ song, query }: { song: SongWithCharts; query: string }) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="group flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-cyan-500/60 hover:bg-zinc-900 sm:p-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-100 group-hover:text-cyan-200">
            {highlight(song.title, query)}
          </h2>
          <p className="mt-1 truncate text-sm text-zinc-400">{song.artist}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {song.charts.map((chart) => (
            <DifficultyBadge
              key={chart.id}
              name={chart.difficultyName}
              level={chart.difficultyLevel}
            />
          ))}
        </div>

        {song.aliases.length > 0 && (
          <p className="text-xs text-zinc-500">
            别名：{song.aliases.map((alias) => alias.alias).join('、')}
          </p>
        )}
      </div>

      <div className="w-1/2 shrink-0">
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-gradient-to-br from-zinc-800/60 to-zinc-900">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6 text-zinc-700"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 15l-5-5L5 20" />
          </svg>
          <span className="text-[11px] text-zinc-600">封面占位</span>
        </div>
      </div>
    </Link>
  );
}
