#!/usr/bin/env node
/**
 * GLITCH / CRASH 等复杂谱面的渲染校验脚本
 *
 * 用法（仓库根目录）：
 *   node scripts/validate-charts.mjs "../Cytus II谱面数据/Cytus II 全谱面 5.3/cherry002_005_3.json" ...
 *
 * 校验内容：
 *   - 音符类型是否都在已实现范围内（0-7）
 *   - 坐标 / tick / page_index 是否合法
 *   - 每一页能否正常渲染，输出中是否有 NaN/undefined
 *   - 每页的元素数量是否与音符数量匹配（粗略下限）
 *
 * 输出：.preview/validation/<谱面名>/page-*.svg、index.html、report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, xOf, yOf, resolveChartMeta } from './render-preview.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = fs.mkdtempSync(path.join(repoRoot, '.preview', 'validation-'));
const SUPPORTED_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
const MIN_CIRCLES = { 0: 3, 1: 2, 2: 2, 3: 2, 4: 2, 5: 1, 6: 2, 7: 2 };

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('请提供至少一个谱面 JSON 路径');
  process.exit(1);
}

const report = { generatedAt: new Date().toISOString(), charts: [], summary: { total: 0, passed: 0 } };

for (const input of files) {
  const file = path.resolve(input);
  const name = path.basename(file, '.json');
  const chart = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = [];
  const warning = [];
  const typeCount = {};
  let unknownTypes = [];
  let crossPageHolds = 0;
  let outOfRange = 0;

  const pages = chart.page_list || [];
  if (!Array.isArray(pages) || pages.length === 0) errors.push('page_list 为空');
  for (let i = 0; i < pages.length; i += 1) {
    const p = pages[i];
    if (!(p.end_tick > p.start_tick)) errors.push(`page ${i} 的 tick 区间非法`);
    if (![1, -1].includes(p.scan_line_direction)) errors.push(`page ${i} 扫描方向非法`);
  }

  const notes = chart.note_list || [];
  for (const n of notes) {
    typeCount[n.type] = (typeCount[n.type] || 0) + 1;
    if (!SUPPORTED_TYPES.has(n.type)) unknownTypes.push(n.type);
    const page = pages[n.page_index];
    if (!page) {
      errors.push(`音符 id=${n.id} 的 page_index=${n.page_index} 越界`);
      continue;
    }
    if (!(n.tick >= page.start_tick && n.tick <= page.end_tick)) {
      errors.push(`音符 id=${n.id} 的 tick=${n.tick} 不在 page ${n.page_index} 区间内`);
    }
    if (!Number.isFinite(n.x) || n.x < 0 || n.x > 1) {
      errors.push(`音符 id=${n.id} 的 x=${n.x} 非法`);
    }
    if (n.hold_tick > 0 && n.tick + n.hold_tick > page.end_tick) crossPageHolds += 1;
    const cx = xOf(n.x);
    const cy = yOf(page, n.tick);
    if (!(cx >= 42 && cx <= 469 && cy >= 51 && cy <= 345)) outOfRange += 1;
  }
  if (unknownTypes.length > 0) {
    unknownTypes = [...new Set(unknownTypes)];
    errors.push(`存在未实现的音符类型：${unknownTypes.join(',')}`);
  }
  if (outOfRange > 0) errors.push(`${outOfRange} 个音符的坐标超出可玩区`);

  // 逐页渲染
  const outDir = path.join(outRoot, name);
  fs.mkdirSync(outDir, { recursive: true });
  const meta = resolveChartMeta(file);
  const pageStats = [];
  for (let i = 0; i < pages.length; i += 1) {
    const svg = renderPage(chart, i, meta);
    if (!svg.startsWith('<svg')) errors.push(`page ${i} 渲染结果不是 SVG`);
    if (/NaN|undefined|Infinity/.test(svg)) errors.push(`page ${i} 输出包含 NaN/undefined`);
    const ownNotes = notes.filter((n) => n.page_index === i);
    const minCircles = ownNotes.reduce((sum, n) => sum + (MIN_CIRCLES[n.type] || 1), 0);
    const circleCount = (svg.match(/<circle/g) || []).length;
    if (circleCount < minCircles) {
      errors.push(`page ${i} 元素数量异常：circle ${circleCount} < 预期下限 ${minCircles}`);
    }
    pageStats.push({ page: i, notes: ownNotes.length, circles: circleCount });
    fs.writeFileSync(path.join(outDir, `page-${String(i).padStart(3, '0')}.svg`), svg, 'utf8');
  }

  const gallery = `<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>${name}</title>
<style>body{margin:0;background:#0b0d10;color:#e8e8ec;font-family:sans-serif}header{padding:20px 28px;border-bottom:1px solid #22262c}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;padding:22px 28px 60px}
figure{margin:0;background:#111418;border:1px solid #1e232a;border-radius:8px;padding:10px}img{width:100%;display:block;border-radius:4px}figcaption{font-size:12px;color:#8b929c;text-align:center;margin-top:6px}</style>
<header><h1>${name}</h1><p>${pages.length} 页 / ${notes.length} 音符 · 校验结果见 report.json</p></header>
<main>${pageStats.map((s) => `<figure><a href="page-${String(s.page).padStart(3, '0')}.svg" target="_blank"><img loading="lazy" src="page-${String(s.page).padStart(3, '0')}.svg"></a><figcaption>${s.notes} notes</figcaption></figure>`).join('')}</main>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), gallery, 'utf8');

  const result = {
    file,
    name,
    pages: pages.length,
    notes: notes.length,
    noteTypes: typeCount,
    holdNotes: notes.filter((n) => n.hold_tick > 0).length,
    crossPageHolds,
    unknownTypes,
    errors: [...new Set(errors)],
    preview: outDir,
    pass: errors.length === 0,
  };
  report.charts.push(result);
  report.summary.total += 1;
  if (result.pass) report.summary.passed += 1;
  console.log(
    `${result.pass ? 'PASS' : 'FAIL'}  ${name}  ${pages.length}p / ${notes.length}n  types=${Object.keys(typeCount).join(',')}  ${result.errors.length ? `errors=${result.errors.length}` : ''}`,
  );
  if (result.errors.length) result.errors.slice(0, 5).forEach((e) => console.log(`   - ${e}`));
}

fs.writeFileSync(path.join(outRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`\n汇总：${report.summary.passed}/${report.summary.total} 通过`);
console.log(`输出目录：${outRoot}`);
