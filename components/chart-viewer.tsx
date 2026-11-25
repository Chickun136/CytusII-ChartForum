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

const PAGE_STEPS = [-10, -1, 1, 10];
const PAGE_COLUMNS = 4;
const CELL_WIDTH = 512;
const CELL_HEIGHT = 384; // 512x420 的页面里 y=384 以下是曲名/难度页脚，导出时裁掉
const EXPORT_SCALE = 2;
const MAX_CANVAS_SIDE = 60000;
const MAX_CANVAS_AREA = 120_000_000;
const DOWNLOAD_BATCH = 8;
const COMING_SOON_DIFFICULTIES = new Set(['DREAM', 'DROP']);

function isComingSoonDifficulty(name: string) {
  return COMING_SOON_DIFFICULTIES.has(name);
}

function ComingSoonChart() {
  return (
    <svg
      viewBox="0 0 512 420"
      role="img"
      aria-label="谱面渲染开发中"
      className="block h-auto w-full"
    >
      <rect width="512" height="420" fill="#050608" />
      {[51, 124.5, 198, 271.5, 345].map((y) => (
        <line
          key={y}
          x1="0"
          x2="512"
          y1={y}
          y2={y}
          stroke="#FFFFFF"
          strokeOpacity="0.14"
          strokeDasharray="6 8"
          strokeWidth="1"
        />
      ))}
      <line x1="42" x2="42" y1="51" y2="345" stroke="#FFFFFF" strokeOpacity="0.08" />
      <line x1="469" x2="469" y1="51" y2="345" stroke="#FFFFFF" strokeOpacity="0.08" />
      <text
        x="256"
        y="212"
        textAnchor="middle"
        fill="#27BF8D"
        fontFamily="'Rajdhani', 'Segoe UI', sans-serif"
        fontSize="34"
        fontWeight="700"
        letterSpacing="1"
      >
        coming s∞n
      </text>
    </svg>
  );
}

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
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [downloadError, setDownloadError] = useState('');
  const viewerRef = useRef<HTMLDivElement>(null);
  const chart = charts[selected] ?? charts[0];

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom((current) => {
        const next = current - event.deltaY * 0.001;
        return Math.min(3, Math.max(0.5, Number(next.toFixed(2))));
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!chart) return;
      if (isComingSoonDifficulty(chart.difficultyName)) return;
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

  const comingSoon = isComingSoonDifficulty(chart.difficultyName);

  const selectChart = (index: number) => {
    setSelected(index);
    setPage(0);
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
        context.drawImage(
          image,
          0,
          0,
          CELL_WIDTH,
          CELL_HEIGHT,
          x,
          y,
          nextX - x,
          nextY - y,
        );
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
            <span className="text-xs text-zinc-400">
              {isComingSoonDifficulty(item.difficultyName) ? 'coming s∞n' : `${item.pageCount} 页`}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="text-xs text-zinc-400">
          <span className="text-zinc-200">{chart.difficultyName}</span>
          {chart.difficultyLevel ? ` ${chart.difficultyLevel}` : ''}
          <span className="mx-2 text-zinc-700">|</span>
          {comingSoon ? 'coming s∞n' : `${chart.pageCount} 页 · ${chart.noteCount} 音符`}
          {!comingSoon && (
            <span className="ml-2 hidden text-zinc-600 sm:inline">Ctrl + 滚轮缩放</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!comingSoon && (
            <>
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
            </>
          )}
          <div className="flex items-center gap-2 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400">
            <span className="font-mono tabular-nums text-zinc-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              title="Ctrl + 滚轮缩放，拖动滚动条平移"
              className="text-zinc-300 transition enabled:hover:text-cyan-200 disabled:opacity-40"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {downloadError && <p className="mt-2 text-xs text-rose-300">{downloadError}</p>}

      <div className="mt-4 flex flex-col gap-3 lg:mx-auto lg:w-[calc(75%_+_5rem)] lg:max-w-full lg:flex-row lg:items-stretch lg:gap-4">
        <div
          ref={viewerRef}
          className="min-w-0 flex-1 overflow-auto rounded-xl border border-zinc-800 bg-[#050608]"
        >
          {comingSoon ? (
            <ComingSoonChart />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={`${chart.difficultyName} 第 ${page + 1} 页`}
              style={{ width: `${zoom * 100}%` }}
              className="block h-auto max-w-none"
            />
          )}
        </div>

        {!comingSoon && (
          <div className="shrink-0 lg:w-16 lg:min-w-16 lg:max-w-16">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 lg:h-full lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1">
              {PAGE_STEPS.slice(0, 2).map((step) => {
                const disabled = page + step < 0;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => jumpPage(step)}
                    disabled={disabled}
                    aria-label={`后退 ${Math.abs(step)} 页`}
                    className="w-9 rounded-md border border-zinc-700 px-0 py-1.5 font-mono text-sm tabular-nums text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 lg:w-full"
                  >
                    {step}
                  </button>
                );
              })}

              <span className="overflow-hidden whitespace-nowrap px-1 text-center text-xs tabular-nums text-zinc-400 lg:w-full lg:px-0 lg:py-1 lg:text-[11px]">
                {page + 1} / {chart.pageCount}
              </span>

              {PAGE_STEPS.slice(2).map((step) => {
                const disabled = page + step > chart.pageCount - 1;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => jumpPage(step)}
                    disabled={disabled}
                    aria-label={`前进 ${step} 页`}
                    className="w-9 rounded-md border border-zinc-700 px-0 py-1.5 font-mono text-sm tabular-nums text-zinc-300 transition enabled:hover:border-cyan-500/60 enabled:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 lg:w-full"
                  >
                    +{step}
                  </button>
                );
              })}

              <input
                type="range"
                min={0}
                max={chart.pageCount - 1}
                value={page}
                onChange={(event) => setPage(Number(event.target.value))}
                aria-label="选择页码"
                className="h-1.5 w-full cursor-pointer accent-cyan-400 lg:h-auto lg:min-h-0 lg:flex-1 lg:w-1.5 lg:self-center lg:[direction:rtl] lg:[writing-mode:vertical-lr]"
              />
            </div>
          </div>
        )}
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
