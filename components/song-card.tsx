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
      className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-cyan-500/60 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-100 group-hover:text-cyan-200">
            {highlight(song.title, query)}
          </h2>
          <p className="mt-1 truncate text-sm text-zinc-400">{song.artist}</p>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
          {song.charts.length} 难度
        </span>
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
    </Link>
  );
}
