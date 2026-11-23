'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
const PAGE_STEPS = [-10, -1, 1, 10];
const PAGE_COLUMNS = 4;
const CELL_WIDTH = 512;
const CELL_HEIGHT = 420;
const EXPORT_SCALE = 2;
const MAX_CANVAS_SIDE = 60000;
const MAX_CANVAS_AREA = 120_000_000;
const DOWNLOAD_BATCH = 8;

function sanitizeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || '未命名';
}

export function ChartViewer({
  charts,
  title,
  artist,
}: {
  charts: ChartSummary[];
  title: string;
  artist: string;
}) {
  const [selected, setSelected] = useState(() => {
    const chaos = charts.findIndex((chart) => chart.difficultyName === 'CHAOS');
    return chaos >= 0 ? chaos : 0;
  });
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [downloadError, setDownloadError] = useState('');
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

  const jumpPage = (step: number) => {
    setPage((current) => Math.min(chart.pageCount - 1, Math.max(0, current + step)));
  };

  const downloadPng = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    setDownloadProgress({ done: 0, total: chart.pageCount });

    const columns = Math.min(PAGE_COLUMNS, chart.pageCount);
    const rows = Math.ceil(chart.pageCount / columns);
    const rawWidth = columns * CELL_WIDTH;
    const rawHeight = rows * CELL_HEIGHT;
    const scale = Math.min(
      EXPORT_SCALE,
      MAX_CANVAS_SIDE / rawWidth,
      MAX_CANVAS_SIDE / rawHeight,
      Math.sqrt(MAX_CANVAS_AREA / (rawWidth * rawHeight)),
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(rawWidth * scale);
    canvas.height = Math.floor(rawHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setDownloadError('浏览器不支持画布渲染，无法导出图片。');
      setDownloading(false);
      return;
    }
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const drawPage = async (pageIndex: number) => {
      const response = await fetch(`/api/charts/${chart.id}/${pageIndex}`);
      if (!response.ok) throw new Error(`第 ${pageIndex + 1} 页加载失败`);
      const svg = await response.text();
      const svgUrl = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      );
      try {
        const image = new Image();
        image.decoding = 'async';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`第 ${pageIndex + 1} 页解码失败`));
          image.src = svgUrl;
        });
        const column = pageIndex % columns;
        const row = Math.floor(pageIndex / columns);
        const x = Math.round((column * canvas.width) / columns);
        const nextX = Math.round(((column + 1) * canvas.width) / columns);
        const y = Math.round((row * canvas.height) / rows);
        const nextY = Math.round(((row + 1) * canvas.height) / rows);
        context.drawImage(image, x, y, nextX - x, nextY - y);
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
      setDownloadProgress((current) => ({ ...current, done: current.done + 1 }));
    };

    try {
      for (let start = 0; start < chart.pageCount; start += DOWNLOAD_BATCH) {
        const batch: Promise<void>[] = [];
        const end = Math.min(start + DOWNLOAD_BATCH, chart.pageCount);
        for (let index = start; index < end; index += 1) {
          batch.push(drawPage(index));
        }
        await Promise.all(batch);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('PNG 生成失败');

      const difficulty = `${chart.difficultyName}${
        chart.difficultyLevel ? ` ${chart.difficultyLevel}` : ''
      }`;
      const fileName = [title, artist, difficulty].map(sanitizeFileName).join('-');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    } catch (error) {
      console.error(error);
      setDownloadError('整谱下载失败，请重试。');
    } finally {
      setDownloading(false);
      setDownloadProgress({ done: 0, total: 0 });
    }
  };

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
          <button
            type="button"
            onClick={downloadPng}
            disabled={downloading}
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
          >
            {downloading
              ? `生成中 ${downloadProgress.done}/${downloadProgress.total}`
              : '下载整谱 PNG'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      {downloadError && <p className="mt-2 text-xs text-rose-300">{downloadError}</p>}

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
        <div className="flex items-center gap-1.5">
          {PAGE_STEPS.map((step) => {
            const target = page + step;
            const disabled = target < 0 || target > chart.pageCount - 1;
            return (
              <button
                key={step}
                type="button"
                onClick={() => jumpPage(step)}
                disabled={disabled}
                aria-label={step < 0 ? `后退 ${Math.abs(step)} 页` : `前进 ${step} 页`}
                className="rounded-md border border-zinc-700 px-2.5 py-1.5 font-mono text-sm tabular-nums text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step > 0 ? `+${step}` : step}
              </button>
            );
          })}
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

      <ChartRating chartId={chart.id} />
    </section>
  );
}

const RATING_STORAGE_PREFIX = 'cytus-chart-rating:';
const ratingListeners = new Set<() => void>();

function subscribeRating(onChange: () => void) {
  ratingListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    ratingListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function setRatingValue(chartId: string, value: number) {
  const key = `${RATING_STORAGE_PREFIX}${chartId}`;
  if (value > 0) {
    window.localStorage.setItem(key, String(value));
  } else {
    window.localStorage.removeItem(key);
  }
  ratingListeners.forEach((listener) => listener());
}

function ChartRating({ chartId }: { chartId: string }) {
  const rating = useSyncExternalStore(
    subscribeRating,
    () => Number(window.localStorage.getItem(`${RATING_STORAGE_PREFIX}${chartId}`)) || 0,
    () => 0,
  );
  const [hover, setHover] = useState(0);

  const choose = (value: number) => {
    setRatingValue(chartId, value === rating ? 0 : value);
  };

  const active = hover || rating;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div>
        <p className="text-sm text-zinc-200">谱面评分</p>
        <p className="mt-1 text-xs text-zinc-500">
          点击星星打分（0–5 星），再点同一颗可取消；评分暂存于本机。
        </p>
      </div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            onMouseEnter={() => setHover(value)}
            onFocus={() => setHover(value)}
            onBlur={() => setHover(0)}
            aria-label={`${value} 星`}
            aria-pressed={rating === value}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
              className={`h-6 w-6 ${value <= active ? 'text-amber-400' : 'text-zinc-600'}`}
            >
              <path d="M12 2.4l2.98 6.36 6.96.92-5.1 4.82 1.3 6.9L12 18.1l-6.14 3.3 1.3-6.9-5.1-4.82 6.96-.92z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 w-14 text-xs text-zinc-400">
          {rating > 0 ? `${rating} / 5` : '未评分'}
        </span>
      </div>
    </div>
  );
}
