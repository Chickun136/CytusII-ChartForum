#!/usr/bin/env node
/**
 * 谱面渲染原型：Cytus II chart JSON -> 每页一个 SVG
 *
 * 用法（在仓库根目录）：
 *   node scripts/render-preview.mjs
 *   node scripts/render-preview.mjs "<chart.json>" [outDir] [--limit N] [--pages 0,1,2]
 *
 * 几何规则由 ct2view 的样张反推：
 *   画布 512x384，横向可玩区 x=42..469（cx = 42 + 427 * x）
 *   纵向可玩区 y=51..345；scan_line_direction=1 表示从下往上扫（y=345 -> 51）
 *   反之为从上往下（y=51 -> 345）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CHART = path.resolve(
  repoRoot,
  '../Cytus II谱面数据/Cytus II 全谱面 5.3/ai001_001_2.json',
);

const W = 512;
const H = 420; // 384 的谱面高度 + 36px 底部信息栏，避免遮挡 y=345 的边界音符
const TOP = 51;
const BOTTOM = 345;
const LEFT = 42;
const X_SPAN = 427;
const FONT = "'Rajdhani', 'Segoe UI', sans-serif";

const COLORS = {
  bg: '#050608',
  grid: '#ffffff',
  click: { outer: '#AFC6CE', outerStroke: '#171822', mid: '#99FFE5', midStroke: '#1D857A', inner: '#CCFFF2' },
  clickGhost: { outer: '#2B2F33', mid: '#263F3F', inner: '#333F3F' },
  chain: { outer: '#ACB4CB', inner: '#F666FF', stroke: '#171822' },
  chainGhost: { outer: '#2B2D32', inner: '#3D193F' },
  hold: '#FFFFFF',
  holdGhost: '#3F3F3F',
  accent: '#27BF8D',
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmt = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

// 与参考仓库 ct2style.css 的难度色块保持一致（背景色 / 文字色）
const DIFF_STYLES = {
  EASY: { bg: '#003366', fg: '#33CCFF' },
  HARD: { bg: '#330000', fg: '#FF3333' },
  CHAOS: { bg: '#330033', fg: '#FF33FF' },
  GLITCH: { bg: '#002E1D', fg: '#00A96B' },
  CRASH: { bg: '#452E13', fg: '#FFC000' },
  DREAM: { bg: '#6E6E6E', fg: '#FFFFFF' },
  DROP: { bg: '#EFEFEF', fg: '#6E6E6E' },
  UNKNOWN: { bg: '#000000', fg: '#FFFFFF' },
};

const SPEED_ACCEL_COLOR = '#DE595D'; // 参考站箭头加速色 rgb(222,89,93)
const SPEED_DECEL_COLOR = '#7AD6B3'; // 参考站箭头减速色 rgb(122,214,179)

const CHARACTER_COLORS = {
  PAFF: '#E86A9A',
  'NEKO#ΦωΦ': '#F2C94C',
  'ROBO_Head': '#56CCF2',
  Ivy: '#27AE60',
  'Crystal PuNK': '#BB6BD9',
  Vanessa: '#EB5757',
  'Bo Bo': '#F2994A',
  'Graff.J': '#9B51E0',
  'Kizuna AI': '#66E3E3',
  Alice: '#F2C94C',
  Hans: '#6D9EEB',
  ConneR: '#C9A227',
  Cherry: '#E15A97',
  Xenon: '#E74C3C',
  JOE: '#F2994A',
  Sagar: '#2D9CDB',
  Rin: '#BB6BD9',
  Aroma: '#27AE60',
  Nora: '#2D9CDB',
  NEKO_II: '#F2C94C',
  Ilka: '#9B51E0',
  Miku: '#39C5BB',
  Amiya: '#2D9CDB',
  Kaf: '#7B61FF',
};

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textWidth(text, size) {
  let width = 0;
  for (const ch of String(text)) {
    width += ch.codePointAt(0) > 0x2e80 ? size : size * 0.56;
  }
  return width;
}

function fitText(text, maxWidth, size) {
  const source = String(text ?? '');
  if (textWidth(source, size) <= maxWidth) return source;
  let out = '';
  for (const ch of source) {
    if (textWidth(`${out}${ch}…`, size) > maxWidth) break;
    out += ch;
  }
  return `${out}…`;
}

function characterColor(name) {
  if (!name) return '#7F8C8D';
  if (CHARACTER_COLORS[name]) return CHARACTER_COLORS[name];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return `hsl(${hash} 55% 48%)`;
}

function monogram(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && /^[A-Za-z]/.test(parts[0]) && /^[A-Za-z]/.test(parts[1])) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return [...name].slice(0, 2).join('');
}

let metadataCache;
function loadMetadata() {
  if (metadataCache !== undefined) return metadataCache;
  const file = path.resolve(repoRoot, 'data/metadata/songs.json');
  try {
    metadataCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    metadataCache = null;
  }
  return metadataCache;
}

/** 从谱面文件名解析歌曲元数据（曲名/角色/难度） */
function resolveChartMeta(file) {
  const base = path.basename(file, '.json');
  const match = base.match(/^(.+)_(\d+)$/);
  const id = match ? match[1] : base;
  const index = match ? match[2] : '';
  const data = loadMetadata();
  const song = data?.songs?.find((s) => s.id === id);
  const chart = song?.charts?.[index];
  return {
    id,
    title: song?.title || id,
    character: song?.character || '',
    difficulty: chart?.difficulty || 'UNKNOWN',
    level: chart?.level || '',
  };
}

function bottomInfo(meta) {
  if (!meta) return [];
  const bandY = 384;
  const bandH = H - bandY;
  const color = characterColor(meta.character);
  const logo = escapeXml(monogram(meta.character));
  const title = escapeXml(fitText(meta.title, 300, 15));
  const label = escapeXml(`${meta.difficulty}${meta.level ? ` ${meta.level}` : ''}`);
  const badgeWidth = Math.max(70, textWidth(label, 13) + 22);
  const badgeX = W - 12 - badgeWidth;
  const diffStyle = DIFF_STYLES[meta.difficulty] || DIFF_STYLES.UNKNOWN;
  return [
    `<rect x="0" y="${bandY}" width="${W}" height="${bandH}" fill="#0A0C0F"/>`,
    `<line x1="0" x2="${W}" y1="${bandY}" y2="${bandY}" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="1"/>`,
    // 左下：角色标识 + 曲名
    `<rect x="12" y="390" width="24" height="24" rx="6" fill="${color}"/>`,
    `<text x="24" y="406.5" fill="#0B0D10" font-family="${FONT}" font-size="11" font-weight="700" text-anchor="middle">${logo}</text>`,
    `<text x="44" y="407" fill="#E8E8EC" font-family="${FONT}" font-size="15">${title}</text>`,
    // 右下：难度徽标（配色与参考站 ct2style.css 一致）
    `<rect x="${fmt(badgeX)}" y="391" width="${fmt(badgeWidth)}" height="22" rx="5" fill="${diffStyle.bg}"/>`,
    `<text x="${fmt(badgeX + badgeWidth / 2)}" y="406.5" fill="${diffStyle.fg}" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle">${label}</text>`,
  ];
}

/** 音符横坐标：JSON 的 x ∈ [0,1] -> 画布坐标 */
function xOf(x) {
  return LEFT + x * X_SPAN;
}

/** 音符纵坐标：tick 映射到当前页的扫描线位置 */
function yOf(page, tick) {
  const span = page.end_tick - page.start_tick;
  const t = span === 0 ? 0 : (tick - page.start_tick) / span;
  return page.scan_line_direction === 1
    ? BOTTOM - t * (BOTTOM - TOP)
    : TOP + t * (BOTTOM - TOP);
}

/** 读取某一 tick 处生效的 BPM（tempo_list 的 value 为每拍微秒数） */
function bpmAtTick(chart, tick) {
  const list = [...(chart.tempo_list || [])].sort((a, b) => a.tick - b.tick);
  let value = list[0]?.value;
  for (const item of list) {
    if (item.tick <= tick) value = item.value;
    else break;
  }
  if (!value) return 120;
  return 60000000 / value;
}

/** 一屏的 scanline 速度：与页 tick 长度成反比，基准为 2 拍（960 tick） */
function pageSpeed(chart, page) {
  const len = page.end_tick - page.start_tick;
  const base = 2 * (chart.time_base || 480);
  return (bpmAtTick(chart, page.start_tick) * base) / len;
}

/** 本页开始时是否发生变速：tick 变短 -> 加速，变长 -> 减速 */
function speedChangeAtPage(chart, index) {
  if (index <= 0 || index >= chart.page_list.length) return null;
  const current = pageSpeed(chart, chart.page_list[index]);
  const previous = pageSpeed(chart, chart.page_list[index - 1]);
  if (Math.abs(current - previous) < 0.01) return null;
  return {
    type: current > previous ? 'accel' : 'decel',
    speed: current,
    previousSpeed: previous,
  };
}

/** 页码/扫描线信息；网格按半拍划分，SCANLINE 速度按 BPM 与页长计算 */
function gridInfo(page, chart) {
  const len = page.end_tick - page.start_tick;
  const timeBase = chart?.time_base || 480;
  const divisions = clamp(Math.max(1, Math.floor(len / (timeBase / 2))), 1, 32);
  const scanline = chart ? Number(pageSpeed(chart, page).toFixed(2)) : 128;
  return { divisions, scanline };
}

function clickNote(cx, cy, ghost = false) {
  const c = ghost ? COLORS.clickGhost : COLORS.click;
  return [
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="29" fill="${c.outer}" stroke="${ghost ? '#050608' : COLORS.click.outerStroke}" stroke-width="${ghost ? 4 : 4}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="20.5" fill="${c.mid}" stroke="${ghost ? '#071D23' : COLORS.click.midStroke}" stroke-width="5"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="9" fill="${c.inner}"/>`,
  ];
}

function chainNode(cx, cy, isHead = false, ghost = false, isCdrag = false) {
  const c = isCdrag
    ? ghost
      ? COLORS.clickGhost
      : { outer: COLORS.click.outer, inner: COLORS.click.mid }
    : ghost
      ? COLORS.chainGhost
      : COLORS.chain;
  const stroke = ghost ? '#050608' : isCdrag ? COLORS.click.outerStroke : COLORS.chain.stroke;
  const ro = isHead ? 23 : 12;
  const ri = isHead ? 16 : 8;
  return [
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${ro}" fill="${c.outer}" stroke="${stroke}" stroke-width="${isHead ? 3 : 2}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${ri}" fill="${c.inner}" stroke="${stroke}" stroke-width="${isHead ? 4 : 2}"/>`,
  ];
}

const chainHeadCache = new WeakMap();
/** 链式音符的“头”：没有其他链节点指向它的那些节点（type 3 一定是头） */
function chainHeadIds(chart) {
  if (chainHeadCache.has(chart)) return chainHeadCache.get(chart);
  const chainTypes = new Set([3, 4, 6, 7]);
  const byId = new Map(chart.note_list.map((n) => [n.id, n]));
  const incoming = new Set();
  for (const n of chart.note_list) {
    if (!chainTypes.has(n.type) || n.next_id <= 0) continue;
    const target = byId.get(n.next_id);
    if (target && chainTypes.has(target.type)) incoming.add(target.id);
  }
  const heads = new Set(
    chart.note_list
      .filter((n) => chainTypes.has(n.type) && (n.type === 3 || !incoming.has(n.id)))
      .map((n) => n.id),
  );
  chainHeadCache.set(chart, heads);
  return heads;
}

function holdNote(cx, yStart, yEnd, ghost = false) {
  const color = ghost ? COLORS.holdGhost : COLORS.hold;
  const y1 = clamp(yStart, TOP, BOTTOM);
  const y2 = clamp(yEnd, TOP, BOTTOM);
  const headColor = ghost ? '#3F3F3F' : '#FFFFFF';
  return [
    `<line x1="${fmt(cx)}" x2="${fmt(cx)}" y1="${fmt(y1)}" y2="${fmt(y2)}" stroke="${color}" stroke-dasharray="4,4" stroke-width="23"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(yStart)}" r="30" fill="${headColor}" stroke="${ghost ? '#050608' : '#171822'}" stroke-width="6"/>`,
    `<rect x="${fmt(cx - 34)}" y="${fmt(yStart - 1)}" width="67" height="3" fill="${headColor}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(yStart)}" r="19" fill="${headColor}" stroke="${ghost ? '#312A28' : '#C669A1'}" stroke-width="6"/>`,
  ];
}

/** 闪烁音符（type 5）的简化复刻：六边形 + 左右箭头 */
function flickNote(cx, cy, ghost = false) {
  const accent = ghost ? '#0A2C21' : COLORS.accent;
  const white = ghost ? '#3F3F3F' : '#FFFFFF';
  const hex = (r) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${fmt(cx + r * Math.cos(a))},${fmt(cy + r * Math.sin(a))}`;
    }).join(' ');
  return [
    // 两侧短线向中心收拢，围成菱形，而不是向外发散成 X 形
    `<line x1="${fmt(cx - 35)}" x2="${fmt(cx - 8)}" y1="${fmt(cy)}" y2="${fmt(cy + 28)}" stroke="${white}" stroke-width="2"/>`,
    `<line x1="${fmt(cx - 35)}" x2="${fmt(cx - 8)}" y1="${fmt(cy)}" y2="${fmt(cy - 28)}" stroke="${white}" stroke-width="2"/>`,
    `<line x1="${fmt(cx + 35)}" x2="${fmt(cx + 8)}" y1="${fmt(cy)}" y2="${fmt(cy + 28)}" stroke="${white}" stroke-width="2"/>`,
    `<line x1="${fmt(cx + 35)}" x2="${fmt(cx + 8)}" y1="${fmt(cy)}" y2="${fmt(cy - 28)}" stroke="${white}" stroke-width="2"/>`,
    `<polygon points="${fmt(cx - 5)},${fmt(cy - 24)} ${fmt(cx - 26)},${fmt(cy - 3)} ${fmt(cx - 26)},${fmt(cy + 3)} ${fmt(cx - 5)},${fmt(cy + 24)} ${fmt(cx + 5)},${fmt(cy + 24)} ${fmt(cx + 26)},${fmt(cy + 3)} ${fmt(cx + 26)},${fmt(cy - 3)} ${fmt(cx + 5)},${fmt(cy - 24)}" fill="${accent}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="11" fill="${white}"/>`,
    `<polygon points="${hex(7.78)}" fill="${white}"/>`,
    `<rect x="${fmt(cx - 2)}" y="${fmt(cy - 18.5)}" width="4" height="37" fill="${accent}"/>`,
    `<polygon points="${fmt(cx - 2)},${fmt(cy - 28)} ${fmt(cx - 27)},${fmt(cy - 3)} ${fmt(cx - 27)},${fmt(cy + 3)} ${fmt(cx - 2)},${fmt(cy + 28)} ${fmt(cx - 2)},${fmt(cy + 23)} ${fmt(cx - 22)},${fmt(cy + 3)} ${fmt(cx - 22)},${fmt(cy - 3)} ${fmt(cx - 2)},${fmt(cy - 23)}" fill="${white}"/>`,
    `<polygon points="${fmt(cx + 2)},${fmt(cy - 28)} ${fmt(cx + 27)},${fmt(cy - 3)} ${fmt(cx + 27)},${fmt(cy + 3)} ${fmt(cx + 2)},${fmt(cy + 28)} ${fmt(cx + 2)},${fmt(cy + 23)} ${fmt(cx + 22)},${fmt(cy + 3)} ${fmt(cx + 22)},${fmt(cy - 3)} ${fmt(cx + 2)},${fmt(cy - 23)}" fill="${white}"/>`,
  ];
}

function renderNote(page, note, ghost = false, isHead = false) {
  const cx = xOf(note.x);
  const cy = yOf(page, note.tick);
  switch (note.type) {
    case 1:
    case 2:
      if (note.hold_tick > 0) {
        return holdNote(cx, cy, yOf(page, note.tick + note.hold_tick), ghost);
      }
      return clickNote(cx, cy, ghost);
    case 3:
      return chainNode(cx, cy, true, ghost, false);
    case 4:
      return chainNode(cx, cy, isHead, ghost, false);
    case 6:
    case 7:
      // 6/7 为点锁（c-drag）：形状同普通锁链，但使用 click 配色
      return chainNode(cx, cy, isHead, ghost, true);
    case 5:
      return flickNote(cx, cy, ghost);
    default:
      return clickNote(cx, cy, ghost);
  }
}

/** 链式音符之间的虚线连接 */
function chainLinks(chart, pageIndex, notes, ghost = false) {
  const byId = new Map(chart.note_list.map((n) => [n.id, n]));
  const page = chart.page_list[pageIndex];
  const chainTypes = new Set([3, 4, 6, 7]);
  const out = [];
  for (const n of notes) {
    if (!chainTypes.has(n.type)) continue;
    const next = byId.get(n.next_id);
    if (!next || !chainTypes.has(next.type)) continue;
    // 同页连接，或连接落在页边界上的下一首链式音符
    const samePage = next.page_index === pageIndex;
    const onBoundary = next.page_index === pageIndex + 1 && next.tick === page.end_tick;
    if (!samePage && !onBoundary) continue;
    out.push(
      `<line x1="${fmt(xOf(n.x))}" x2="${fmt(xOf(next.x))}" y1="${fmt(yOf(page, n.tick))}" y2="${fmt(yOf(page, next.tick))}" stroke="#FFFFFF" stroke-dasharray="3,3" stroke-opacity="${ghost ? 0.3 : 0.7}" stroke-width="5"/>`,
    );
  }
  return out;
}

function renderPage(chart, pageIndex, meta = null) {
  const page = chart.page_list[pageIndex];
  const notes = chart.note_list.filter((n) => n.page_index === pageIndex);
  const nextPageIndex = pageIndex + 1;
  const nextPage = nextPageIndex < chart.page_list.length ? chart.page_list[nextPageIndex] : null;
  const nextNotes = nextPage
    ? chart.note_list.filter((n) => n.page_index === nextPageIndex)
    : [];
  const { divisions, scanline } = gridInfo(page, chart);
  const change = speedChangeAtPage(chart, pageIndex);
  const changeColor = change
    ? change.type === 'accel'
      ? SPEED_ACCEL_COLOR
      : SPEED_DECEL_COLOR
    : null;
  // 变速页的左侧箭头同步着色（红=加速，绿=减速）
  const arrowColor = change
    ? change.type === 'accel'
      ? SPEED_ACCEL_COLOR
      : SPEED_DECEL_COLOR
    : '#FFFFFF';

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="chart page ${pageIndex}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.bg}"/>`,
  );
  const heads = chainHeadIds(chart);

  // 下一页音符的淡显层（与参考站一致，用于页与页衔接）
  if (nextNotes.length > 0) {
    parts.push('<g class="ghost" opacity="0.55">');
    parts.push(...chainLinks(chart, nextPageIndex, nextNotes, true));
    for (const n of nextNotes) parts.push(...renderNote(nextPage, n, true, heads.has(n.id)));
    parts.push('</g>');
  }

  // 扫描线网格
  parts.push(
    `<line x1="0" x2="${W}" y1="${TOP}" y2="${TOP}" stroke="${COLORS.grid}" stroke-dasharray="1,19" stroke-width="2"/>`,
    `<line x1="0" x2="${W}" y1="${BOTTOM}" y2="${BOTTOM}" stroke="${COLORS.grid}" stroke-dasharray="1,19" stroke-width="2"/>`,
  );
  for (let i = 0; i <= divisions; i += 1) {
    const y = TOP + ((BOTTOM - TOP) * i) / divisions;
    const major = i % 2 === 0;
    parts.push(
      `<line x1="0" x2="${W}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="${COLORS.grid}" stroke-opacity="${major ? 0.7 : 0.4}" stroke-width="${major ? 2 : 1}"/>`,
    );
  }

  // 第 0 页：红色初始速度标记线
  if (pageIndex === 0) {
    const y = page.scan_line_direction === 1 ? BOTTOM : TOP;
    parts.push(
      `<line x1="0" x2="${W}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="#FF0000" stroke-width="2" stroke-opacity="0.5"/>`,
    );
  }

  // 左侧扫描方向指示（有变速时同步变色）
  const indicator =
    page.scan_line_direction === 1
      ? '0,88 0,306 17,306 17,144 32,144'
      : '0,306 0,88 17,88 17,250 32,250';
  parts.push(
    `<polygon points="${indicator}" fill="${arrowColor}" fill-opacity="0.85"/>`,
  );

  // 本页音符（实色）
  parts.push(...chainLinks(chart, pageIndex, notes, false));
  for (const n of notes) parts.push(...renderNote(page, n, false, heads.has(n.id)));

  // 变速横线画在音符之上，确保在页首边界清晰可见（红=加速，绿=减速）
  if (change) {
    const y = page.scan_line_direction === 1 ? BOTTOM : TOP;
    parts.push(
      `<line x1="0" x2="${W}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="#050608" stroke-width="5" stroke-opacity="0.55"/>`,
      `<line x1="0" x2="${W}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="${changeColor}" stroke-width="3" stroke-opacity="0.95"/>`,
    );
  }

  // 顶部信息
  parts.push(
    `<text x="${W * 0.105}" y="34.56" fill="#AAAAAA" font-family="${FONT}" font-size="30" font-weight="bold" text-anchor="end">${pageIndex}</text>`,
    `<text x="435" y="21" fill="#FFFFFF" font-family="${FONT}" font-size="18" font-weight="bold" text-anchor="end">SCANLINE:</text>`,
    `<text x="507" y="21" fill="#FFFFFF" font-family="${FONT}" font-size="18" font-weight="bold" text-anchor="end">${scanline}</text>`,
  );
  parts.push(...bottomInfo(meta));
  parts.push('</svg>');
  return parts.join('\n');
}

function parseArgs(argv) {
  const args = { chart: DEFAULT_CHART, outDir: null, limit: Infinity, pages: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--pages') args.pages = argv[++i].split(',').map(Number);
    else rest.push(a);
  }
  if (rest[0]) args.chart = path.resolve(rest[0]);
  if (rest[1]) args.outDir = path.resolve(rest[1]);
  return args;
}

function buildGallery(outDir, pages, meta) {
  const items = pages
    .map(
      (p) =>
        `<figure><a href="page-${String(p).padStart(3, '0')}.svg" target="_blank"><img loading="lazy" src="page-${String(p).padStart(3, '0')}.svg" alt="page ${p}"></a><figcaption>Page ${p}</figcaption></figure>`,
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title} — 渲染预览</title>
<style>
  body { margin: 0; background: #0b0d10; color: #e8e8ec; font-family: 'Segoe UI', sans-serif; }
  header { padding: 24px 32px; border-bottom: 1px solid #22262c; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  p { margin: 0; color: #9aa0a8; font-size: 13px; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding: 24px 32px 64px; }
  figure { margin: 0; background: #111418; border: 1px solid #1e232a; border-radius: 8px; padding: 10px; }
  img { width: 100%; height: auto; display: block; border-radius: 4px; background: #050608; }
  figcaption { margin-top: 8px; font-size: 12px; color: #8b929c; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>${meta.title}</h1>
  <p>${meta.pages} 页 / ${meta.notes} 音符 / 难度序号 ${meta.difficulty} · 原型输出，仅用于与参考站对照</p>
</header>
<main>
${items}
</main>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.chart)) {
    console.error(`找不到谱面文件：${args.chart}`);
    process.exit(1);
  }
  const chart = JSON.parse(fs.readFileSync(args.chart, 'utf8'));
  const base = path.basename(args.chart, '.json');
  const outDir = args.outDir || path.resolve(repoRoot, '.preview', base);
  fs.mkdirSync(outDir, { recursive: true });

  const all = chart.page_list.map((_, i) => i);
  const targets = args.pages || all.slice(0, args.limit);
  const meta = resolveChartMeta(args.chart);

  for (const p of targets) {
    const svg = renderPage(chart, p, meta);
    fs.writeFileSync(path.join(outDir, `page-${String(p).padStart(3, '0')}.svg`), svg, 'utf8');
  }
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    buildGallery(outDir, targets, {
      title: `${meta.title} · ${meta.difficulty}${meta.level ? ` ${meta.level}` : ''}`,
      pages: targets.length,
      notes: chart.note_list.length,
      difficulty: base.split('_').pop(),
    }),
    'utf8',
  );

  console.log(`已渲染 ${targets.length} 页 -> ${outDir}`);
  console.log(`打开 ${path.join(outDir, 'index.html')} 查看`);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

export {
  renderPage,
  renderNote,
  chainLinks,
  xOf,
  yOf,
  gridInfo,
  buildGallery,
  resolveChartMeta,
  bottomInfo,
  speedChangeAtPage,
  pageSpeed,
};
