'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';

type PaginationProps = {
  page: number;
  totalPages: number;
};

export function Pagination({ page, totalPages }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [jump, setJump] = useState('');

  const go = (target: number) => {
    const next = Math.min(totalPages, Math.max(1, Math.floor(target)));
    if (next === page) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === 1) {
      params.delete('page');
    } else {
      params.set('page', String(next));
    }
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  };

  const submitJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(jump);
    if (!Number.isFinite(value)) return;
    go(value);
    setJump('');
  };

  if (totalPages <= 1) return null;

  const buttonClass =
    'h-8 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className={`mt-6 flex flex-wrap items-center justify-center gap-2 transition ${
        pending ? 'opacity-70' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className={buttonClass}
      >
        上一页
      </button>
      <span className="px-2 text-xs tabular-nums text-zinc-400">
        第 {page} / {totalPages} 页
      </span>
      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className={buttonClass}
      >
        下一页
      </button>
      <form onSubmit={submitJump} className="ml-2 flex items-center gap-2">
        <label htmlFor="page-jump" className="text-xs text-zinc-500">
          跳至
        </label>
        <input
          id="page-jump"
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(event) => setJump(event.target.value)}
          className="h-8 w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-center text-xs text-zinc-200 outline-none transition focus:border-cyan-500"
        />
        <button type="submit" className={buttonClass}>
          跳转
        </button>
      </form>
    </div>
  );
}
