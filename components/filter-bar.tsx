'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 16;

type FilterBarProps = {
  characters: string[];
  selected: string[];
  query: string;
  min: number;
  max: number;
};

export function FilterBar({ characters, selected, query, min, max }: FilterBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [range, setRange] = useState<[number, number]>([min, max]);
  const rangeRef = useRef<[number, number]>([min, max]);
  const dragging = useRef<'min' | 'max' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const navigate = (nextCharacters: string[], nextRange: [number, number]) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nextCharacters.length > 0) params.set('chars', nextCharacters.join(','));
    if (nextRange[0] > MIN_DIFFICULTY || nextRange[1] < MAX_DIFFICULTY) {
      params.set('min', String(nextRange[0]));
      params.set('max', String(nextRange[1]));
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `/?${search}` : '/', { scroll: false });
    });
  };

  const setValues = (next: [number, number]) => {
    rangeRef.current = next;
    setRange(next);
  };

  const valueAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return MIN_DIFFICULTY;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(MIN_DIFFICULTY + ratio * (MAX_DIFFICULTY - MIN_DIFFICULTY));
  };

  const applyValue = (handle: 'min' | 'max', value: number) => {
    const [low, high] = rangeRef.current;
    setValues(
      handle === 'min' ? [Math.min(value, high), high] : [low, Math.max(value, low)],
    );
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const value = valueAt(event.clientX);
    const [low, high] = rangeRef.current;
    const handle = Math.abs(value - low) <= Math.abs(value - high) ? 'min' : 'max';
    dragging.current = handle;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyValue(handle, value);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    applyValue(dragging.current, valueAt(event.clientX));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = null;
    navigate(selected, rangeRef.current);
  };

  const nudge = (handle: 'min' | 'max', delta: number) => {
    const [low, high] = rangeRef.current;
    const next: [number, number] =
      handle === 'min'
        ? [Math.min(high, Math.max(MIN_DIFFICULTY, low + delta)), high]
        : [low, Math.min(MAX_DIFFICULTY, Math.max(low, high + delta))];
    if (next[0] === low && next[1] === high) return;
    setValues(next);
    navigate(selected, next);
  };

  const toggleCharacter = (character: string) => {
    const next = selected.includes(character)
      ? selected.filter((item) => item !== character)
      : [...selected, character];
    navigate(next, rangeRef.current);
  };

  const percent = (value: number) =>
    ((value - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY)) * 100;

  return (
    <div className={`mt-4 space-y-3 transition ${pending ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-zinc-500">角色</span>
        {characters.map((character) => {
          const active = selected.includes(character);
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
    </div>
  );
}
