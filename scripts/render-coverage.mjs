import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { renderPage, resolveChartMeta } from './render-preview.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
}

const dataDir = path.resolve(
  root,
  argValue('--data-dir', path.join('..', 'Cytus II谱面数据', 'Cytus II 全谱面 5.3')),
);
const outFile = path.resolve(root, argValue('--out', 'data/reports/render-coverage.json'));
const mode = args.includes('--all-pages') ? 'all' : 'sample';
const limit = args.includes('--limit') ? Math.max(1, Number(argValue('--limit', '0')) || 0) : Infinity;

if (!fs.existsSync(dataDir)) {
  console.error(`找不到谱面目录：${dataDir}`);
  process.exit(1);
}

const allFiles = fs
  .readdirSync(dataDir)
  .filter((file) => file.endsWith('.json'))
  .sort();
const files = allFiles.slice(0, limit);
const sampleStep = Math.max(1, Math.floor(files.length / 5));
const sampleIndices = new Set([0, sampleStep, sampleStep * 2, sampleStep * 3, sampleStep * 4].filter((i) => i < files.length));

const typeCounts = {};
for (let type = 0; type <= 9; type += 1) typeCounts[type] = 0;

const report = {
  generatedAt: new Date().toISOString(),
  dataDir: path.relative(root, dataDir).replace(/\\/g, '/'),
  mode,
  rendererVersion: 'v2',
  charts: { total: files.length, rendered: 0, failed: 0 },
  pages: { total: 0, rendered: 0 },
  notes: 0,
  types: typeCounts,
  unsupported: { charts: 0, notes: 0, types: [8, 9] },
  geometry: { outOfRangeX: 0, invalidPageIndex: 0, invalidPageTicks: 0 },
  samples: [],
  failures: [],
  timing: { totalMs: 0, avgPageMs: 0, maxSvgBytes: 0, avgSvgBytes: 0 },
};

const failedCharts = new Set();
let svgBytes = 0;
let renderPages = 0;
const startAll = performance.now();

for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
  const file = files[fileIndex];
  const filePath = path.join(dataDir, file);

  let chart;
  try {
    chart = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    report.failures.push({ chart: file, error: `JSON 解析失败：${error.message}` });
    failedCharts.add(file);
    continue;
  }

  const pageList = Array.isArray(chart.page_list) ? chart.page_list : [];
  const noteList = Array.isArray(chart.note_list) ? chart.note_list : [];
  if (pageList.length === 0) {
    report.failures.push({ chart: file, error: 'page_list 为空' });
    failedCharts.add(file);
    continue;
  }

  report.pages.total += pageList.length;
  report.notes += noteList.length;

  let chartHasUnsupported = false;
  for (const note of noteList) {
    typeCounts[note.type] = (typeCounts[note.type] || 0) + 1;
    if (note.type === 8 || note.type === 9) {
      chartHasUnsupported = true;
      report.unsupported.notes += 1;
    }
    if (note.x < -1 || note.x > 1) report.geometry.outOfRangeX += 1;
    if (!Number.isInteger(note.page_index) || note.page_index < 0 || note.page_index >= pageList.length) {
      report.geometry.invalidPageIndex += 1;
    }
  }
  if (chartHasUnsupported) report.unsupported.charts += 1;

  for (let i = 0; i < pageList.length; i += 1) {
    const page = pageList[i];
    if (!(page.end_tick > page.start_tick)) report.geometry.invalidPageTicks += 1;
  }

  const targets =
    mode === 'all'
      ? pageList.map((_, i) => i)
      : [...new Set([0, Math.floor((pageList.length - 1) / 2), pageList.length - 1])];

  const meta = resolveChartMeta(filePath);
  let chartFailed = false;
  let sampleBytes = 0;
  let sampleMs = 0;
  for (const pageIndex of targets) {
    const started = performance.now();
    try {
      const svg = renderPage(chart, pageIndex, meta);
      const elapsed = performance.now() - started;
      if (/NaN|undefined|Infinity/.test(svg)) {
        report.failures.push({ chart: file, page: pageIndex, error: 'SVG 出现 NaN/undefined/Infinity' });
        chartFailed = true;
      }
      renderPages += 1;
      svgBytes += svg.length;
      report.timing.maxSvgBytes = Math.max(report.timing.maxSvgBytes, svg.length);
      sampleBytes += svg.length;
      sampleMs += elapsed;
    } catch (error) {
      report.failures.push({ chart: file, page: pageIndex, error: error.message });
      chartFailed = true;
    }
  }

  if (chartFailed) {
    failedCharts.add(file);
  } else {
    report.charts.rendered += 1;
  }

  if (sampleIndices.has(fileIndex)) {
    report.samples.push({
      chart: file,
      pages: pageList.length,
      notes: noteList.length,
      renderedPages: targets.length,
      svgBytes: sampleBytes,
      renderMs: Math.round(sampleMs * 100) / 100,
    });
  }

  if ((fileIndex + 1) % 200 === 0 || fileIndex === files.length - 1) {
    console.log(`进度 ${fileIndex + 1}/${files.length}，已渲染 ${renderPages} 页`);
  }
}

report.charts.failed = failedCharts.size;
report.pages.rendered = renderPages;
report.timing.totalMs = Math.round(performance.now() - startAll);
report.timing.avgPageMs = renderPages ? Math.round((report.timing.totalMs / renderPages) * 100) / 100 : 0;
report.timing.avgSvgBytes = renderPages ? Math.round(svgBytes / renderPages) : 0;
report.failures = report.failures.slice(0, 50);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('--- 渲染覆盖汇总 ---');
console.log(`谱面：${report.charts.rendered}/${report.charts.total} 成功，${report.charts.failed} 失败`);
console.log(`页数：${report.pages.rendered}/${report.pages.total}（模式：${mode}）`);
console.log(`音符：${report.notes}；type 8/9：${report.unsupported.notes}（${report.unsupported.charts} 张谱面）`);
console.log(`耗时：${report.timing.totalMs} ms，平均 ${report.timing.avgPageMs} ms/页`);
console.log(`报告：${outFile}`);
if (report.failures.length > 0) {
  console.log(`失败样例：${JSON.stringify(report.failures.slice(0, 3))}`);
  process.exitCode = 1;
}
