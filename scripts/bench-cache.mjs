import { performance } from 'node:perf_hooks';
import { getChartPageSvg, clearChartCache, CHART_CACHE_DIR } from '../lib/chart-service.mjs';

const chartId = process.argv[2] || 'ai001_001_2';
const pageIndex = Number(process.argv[3] || 0);

if (!Number.isInteger(pageIndex) || pageIndex < 0) {
  console.error('页码必须是大于等于 0 的整数');
  process.exit(1);
}

await clearChartCache(chartId);

const coldStart = performance.now();
const cold = await getChartPageSvg(chartId, pageIndex);
const coldMs = performance.now() - coldStart;

if (!cold) {
  console.error(`页码 ${pageIndex} 超出 ${chartId} 的范围`);
  process.exit(1);
}

const warmTimes = [];
let warmResult = cold;
for (let i = 0; i < 20; i += 1) {
  const started = performance.now();
  warmResult = await getChartPageSvg(chartId, pageIndex);
  warmTimes.push(performance.now() - started);
}

const warmAvg = warmTimes.reduce((sum, value) => sum + value, 0) / warmTimes.length;

console.log(
  JSON.stringify(
    {
      chartId,
      page: pageIndex,
      pageCount: cold.pageCount,
      svgBytes: Buffer.byteLength(cold.svg, 'utf8'),
      coldMs: Math.round(coldMs * 100) / 100,
      warmAvgMs: Math.round(warmAvg * 100) / 100,
      warmMinMs: Math.round(Math.min(...warmTimes) * 100) / 100,
      coldCached: cold.cached,
      warmCached: warmResult.cached,
      cacheDir: CHART_CACHE_DIR,
    },
    null,
    2,
  ),
);
