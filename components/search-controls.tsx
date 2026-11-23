'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { SongSort } from '@/lib/songs';

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 16;

type SearchControlsProps = {
  characters: string[];
  query: string;
  selected: string[];
  min: number;
  max: number;
  sort: SongSort;
};

export function SearchControls({
  characters,
  query,
  selected,
  min,
  max,
  sort,
}: SearchControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState(query);
  const [picked, setPicked] = useState<string[]>(selected);
  const [range, setRange] = useState<[number, number]>([min, max]);
  const [sortValue, setSortValue] = useState<SongSort>(sort);
  const dragging = useRef<'min' | 'max' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const trimmed = keyword.trim();
    if (trimmed) params.set('q', trimmed);
    if (picked.length > 0) params.set('chars', picked.join(','));
    if (range[0] > MIN_DIFFICULTY || range[1] < MAX_DIFFICULTY) {
      params.set('min', String(range[0]));
      params.set('max', String(range[1]));
    }
    if (sortValue !== 'default') params.set('sort', sortValue);
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/?${search}` : '/', { scroll: false });
    });
  };

  const valueAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return MIN_DIFFICULTY;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(MIN_DIFFICULTY + ratio * (MAX_DIFFICULTY - MIN_DIFFICULTY));
  };

  const applyValue = (handle: 'min' | 'max', value: number) => {
    setRange(([low, high]) =>
      handle === 'min' ? [Math.min(value, high), high] : [low, Math.max(value, low)],
    );
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const value = valueAt(event.clientX);
    const handle = Math.abs(value - range[0]) <= Math.abs(value - range[1]) ? 'min' : 'max';
    dragging.current = handle;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyValue(handle, value);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    applyValue(dragging.current, valueAt(event.clientX));
  };

  const endDrag = () => {
    dragging.current = null;
  };

  const nudge = (handle: 'min' | 'max', delta: number) => {
    setRange(([low, high]) =>
      handle === 'min'
        ? [Math.min(high, Math.max(MIN_DIFFICULTY, low + delta)), high]
        : [low, Math.min(MAX_DIFFICULTY, Math.max(low, high + delta))],
    );
  };

  const toggleCharacter = (character: string) => {
    setPicked((current) =>
      current.includes(character)
        ? current.filter((item) => item !== character)
        : [...current, character],
    );
  };

  const percent = (value: number) =>
    ((value - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY)) * 100;

  return (
    <form
      onSubmit={submit}
      className={`mt-4 space-y-3 transition ${pending ? 'opacity-70' : ''}`}
    >
      <div>
        <label htmlFor="search-input" className="sr-only">
          搜索曲目
        </label>
        <input
          id="search-input"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="输入歌名、拼音、首字母或外号…"
          autoComplete="off"
          className="h-[34px] w-full max-w-md rounded-full border border-zinc-800 bg-zinc-900 px-4 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-zinc-500">角色</span>
        {characters.map((character) => {
          const active = picked.includes(character);
          return (
            <button
              key={character}
              type="button"
              onClick={() => toggleCharacter(character)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                active
                  ? 'border-cyan-400 bg-cyan-500 font-medium text-zinc-950'
                  : 'border-zinc-800 text-zinc-400 hover:border-cyan-500/60 hover:text-cyan-200'
              }`}
            >
              {character}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-500">难度</span>
        <div className="flex min-w-[240px] max-w-md flex-1 items-center gap-3">
          <div
            ref={trackRef}
            role="group"
            aria-label="难度范围"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative h-6 flex-1 cursor-pointer touch-none select-none"
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-700" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cyan-500"
              style={{
                left: `${percent(range[0])}%`,
                right: `${100 - percent(range[1])}%`,
              }}
            />
            {(['min', 'max'] as const).map((handle) => {
              const value = handle === 'min' ? range[0] : range[1];
              return (
                <button
                  key={handle}
                  type="button"
                  role="slider"
                  aria-label={handle === 'min' ? '最低难度' : '最高难度'}
                  aria-valuemin={MIN_DIFFICULTY}
                  aria-valuemax={MAX_DIFFICULTY}
                  aria-valuenow={value}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      nudge(handle, -1);
                    }
                    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      nudge(handle, 1);
                    }
                  }}
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-zinc-950 shadow"
                  style={{ left: `${percent(value)}%` }}
                />
              );
            })}
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-zinc-300">
            {range[0]} – {range[1]}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="h-[34px] rounded-full bg-cyan-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
        >
          搜索
        </button>
        <label htmlFor="sort-select" className="ml-1 text-xs text-zinc-500">
          排序
        </label>
        <select
          id="sort-select"
          value={sortValue}
          onChange={(event) => setSortValue(event.target.value as SongSort)}
          className="h-[34px] rounded-full border border-zinc-800 bg-zinc-900 px-3 text-[13px] text-zinc-300 outline-none transition focus:border-cyan-500"
        >
          <option value="default">默认顺序</option>
          <option value="difficulty-desc">最高难度 ↓</option>
          <option value="difficulty-asc">最高难度 ↑</option>
        </select>
      </div>
    </form>
  );
}
