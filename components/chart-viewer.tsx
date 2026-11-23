'use client';

import { useEffect, useRef, useState } from 'react';
import { DifficultyBadge } from './difficulty-badge';

export type ChartSummary = {
  id: string;
  difficultyName: string;
  difficultyLevel: string | null;
  pageCount: number;
  noteCount: number;
  jsonFile: string;
};

const ZOOM_LEVELS = [1, 1.5, 2];

export function ChartViewer({ charts }: { charts: ChartSummary[] }) {
  const [selected, setSelected] = useState(() => {
    const chaos = charts.findIndex((chart) => chart.difficultyName === 'CHAOS');
    return chaos >= 0 ? chaos : 0;
  });
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const chart = charts[selected] ?? charts[0];

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!chart) return;
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft') setPage((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') {
        setPage((current) => Math.min(chart.pageCount - 1, current + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chart]);

  if (!chart) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-400">
        暂无可查看的谱面。
      </div>
    );
  }

  const selectChart = (index: number) => {
    setSelected(index);
    setPage(0);
    setZoom(1);
  };

  const toggleFullscreen = async () => {
    if (!viewerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await viewerRef.current.requestFullscreen();
    }
  };

  const imageUrl = `/api/charts/${chart.id}/${page}`;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2">
        {charts.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectChart(index)}
            aria-pressed={index === selected}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              index === selected
                ? 'border-cyan-400/70 bg-cyan-400/10'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'
            }`}
          >
            <DifficultyBadge name={item.difficultyName} level={item.difficultyLevel} />
            <span className="text-xs text-zinc-400">{item.pageCount} 页</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="text-xs text-zinc-400">
          <span className="text-zinc-200">{chart.difficultyName}</span>
          {chart.difficultyLevel ? ` ${chart.difficultyLevel}` : ''}
          <span className="mx-2 text-zinc-700">|</span>
          {chart.pageCount} 页 · {chart.noteCount} 音符
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            打开 SVG
          </a>
          <a
            href={imageUrl}
            download={`${chart.id}-${page}.svg`}
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            下载
          </a>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      <div
        ref={viewerRef}
        className="mt-4 overflow-auto rounded-xl border border-zinc-800 bg-[#050608]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${chart.difficultyName} 第 ${page + 1} 页`}
          className="block h-auto max-w-none"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(chart.pageCount - 1, current + 1))}
            disabled={page >= chart.pageCount - 1}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
          <span className="ml-2 text-xs text-zinc-400">
            {page + 1} / {chart.pageCount}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-3 sm:justify-center">
          <input
            type="range"
            min={0}
            max={chart.pageCount - 1}
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
            aria-label="选择页码"
            className="h-1.5 w-full max-w-xs cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="flex items-center gap-1">
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoom(level)}
              aria-pressed={zoom === level}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
                zoom === level
                  ? 'border-cyan-400/70 bg-cyan-400/10 text-cyan-200'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {Math.round(level * 100)}%
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
