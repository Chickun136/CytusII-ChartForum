import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, resolveChartMeta } from '../scripts/render-preview.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER_VERSION = 'v1';
const MAX_CACHED_CHARTS = 8;

function resolveDataDir() {
  if (process.env.CHART_DATA_DIR) return path.resolve(process.env.CHART_DATA_DIR);
  const candidates = [
    path.resolve(repoRoot, '..', 'Cytus II谱面数据', 'Cytus II 全谱面 5.3'),
    path.resolve(repoRoot, 'data', 'raw'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
}

export const CHART_DATA_DIR = resolveDataDir();
export const CHART_CACHE_DIR = process.env.CHART_CACHE_DIR
  ? path.resolve(process.env.CHART_CACHE_DIR)
  : path.join(repoRoot, '.cache', 'charts');

const chartCache = new Map();
const inflight = new Map();

function assertChartId(chartId) {
  if (!/^[A-Za-z0-9]+_\d+_\d+$/.test(chartId)) {
    const error = new Error('非法谱面 ID');
    error.code = 'INVALID_CHART_ID';
    throw error;
  }
}

function loadChart(chartId) {
  assertChartId(chartId);
  const file = path.join(CHART_DATA_DIR, `${chartId}.json`);
  const stat = fs.statSync(file);
  const signature = `${Math.round(stat.mtimeMs)}-${stat.size}-${RENDERER_VERSION}`;
  const cached = chartCache.get(chartId);
  if (cached && cached.signature === signature) return cached;

  const chart = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entry = {
    chart,
    meta: resolveChartMeta(file),
    signature,
    signatureHash: crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12),
  };

  chartCache.delete(chartId);
  chartCache.set(chartId, entry);
  if (chartCache.size > MAX_CACHED_CHARTS) {
    chartCache.delete(chartCache.keys().next().value);
  }
  return entry;
}

export function getChartMeta(chartId) {
  const { chart, meta } = loadChart(chartId);
  return { ...meta, pageCount: chart.page_list.length, noteCount: chart.note_list.length };
}

/**
 * 读取一页 SVG；首次渲染后写入 .cache/charts/<chartId>/<signature>/<page>.svg。
 * 返回 null 表示页码越界。
 */
export async function getChartPageSvg(chartId, pageIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    const error = new Error('非法页码');
    error.code = 'INVALID_PAGE';
    throw error;
  }

  const { chart, meta, signatureHash } = loadChart(chartId);
  if (pageIndex >= chart.page_list.length) return null;

  const cacheDir = path.join(CHART_CACHE_DIR, chartId, signatureHash);
  const cacheFile = path.join(cacheDir, `${pageIndex}.svg`);
  const etag = `"${chartId}-${pageIndex}-${signatureHash}"`;

  try {
    const svg = await fs.promises.readFile(cacheFile, 'utf8');
    return { svg, cached: true, etag, pageCount: chart.page_list.length };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const key = `${chartId}:${pageIndex}:${signatureHash}`;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    const svg = renderPage(chart, pageIndex, meta);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.writeFile(tmp, svg, 'utf8');
    await fs.promises.rename(tmp, cacheFile);
    return { svg, cached: false, etag, pageCount: chart.page_list.length };
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function clearChartCache(chartId) {
  if (chartId) {
    assertChartId(chartId);
    await fs.promises.rm(path.join(CHART_CACHE_DIR, chartId), { recursive: true, force: true });
    return;
  }
  await fs.promises.rm(CHART_CACHE_DIR, { recursive: true, force: true });
}
