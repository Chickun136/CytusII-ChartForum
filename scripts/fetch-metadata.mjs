#!/usr/bin/env node
/**
 * 曲目元数据索引生成器
 *
 * 数据来源：
 *   1. ct2view（KiattipoomR/ct2view）的 chartlist/<曲目ID>/chaos.html 页头
 *      提供：曲名、艺术家、角色、BPM、Scanline、Combo、页数、CHAOS 等级
 *   2. CytusII Wiki* 楽曲一覧（wikiwiki.jp/cytus-2）
 *      提供：EASY / HARD / CHAOS / GLITCH / CRASH 等级
 *
 * 用法（在仓库根目录）：
 *   node --use-system-ca scripts/fetch-metadata.mjs
 *   node --use-system-ca scripts/fetch-metadata.mjs --concurrency 12
 *
 * 输出：
 *   data/metadata/songs.json     最终索引
 *   .preview/metadata-cache/     原始 HTML 片段缓存（已 gitignore）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CHART_DIR = path.resolve(repoRoot, '../Cytus II谱面数据/Cytus II 全谱面 5.3');
const DEFAULT_OUT = path.resolve(repoRoot, 'data/metadata/songs.json');
const CACHE_DIR = path.resolve(repoRoot, '.preview/metadata-cache');
const REMOTE_TREE = 'https://api.github.com/repos/KiattipoomR/ct2view/git/trees/main?recursive=1';
const REMOTE_CHART_BASE = 'https://raw.githubusercontent.com/KiattipoomR/ct2view/main/chartlist';
const WIKI_URL = 'https://wikiwiki.jp/cytus-2/%E6%A5%BD%E6%9B%B2%E4%B8%80%E8%A6%A7';

const DIFFICULTY_NAMES = {
  0: 'EASY',
  1: 'HARD',
  2: 'CHAOS',
  3: 'GLITCH',
  4: 'CRASH',
  5: 'DREAM',
  6: 'DROP',
};

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const concurrency = Number(argValue('--concurrency', '8'));
const chartDir = path.resolve(argValue('--data', DEFAULT_CHART_DIR));
const outFile = path.resolve(argValue('--out', DEFAULT_OUT));

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function normalizeTitle(s) {
  return decodeEntities(stripTags(s))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, '');
}

function looseTitle(s) {
  return normalizeTitle(s)
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（[^）]*）/g, '');
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        results[index] = { error: err.message };
      }
      done += 1;
      if (done % 50 === 0 || done === items.length) {
        console.log(`  进度 ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function localSongs() {
  const files = fs.readdirSync(chartDir).filter((f) => f.endsWith('.json'));
  const map = new Map();
  for (const file of files) {
    const m = file.match(/^(.+)_(\d+)\.json$/);
    if (!m) continue;
    const [, id, idx] = m;
    if (!map.has(id)) map.set(id, { id, files: {} });
    map.get(id).files[idx] = file;
  }
  return map;
}

async function remoteSongIds() {
  const res = await fetch(REMOTE_TREE, { headers: { 'User-Agent': 'cytus-chart-forum' } });
  if (!res.ok) throw new Error(`ct2view tree 请求失败：HTTP ${res.status}`);
  const json = await res.json();
  const ids = new Set();
  for (const item of json.tree) {
    const m = item.path.match(/^chartlist\/([^/]+)\/chaos\.html$/);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

function parseChartHeader(html) {
  const text = (re) => {
    const m = html.match(re);
    return m ? stripTags(m[1]) : null;
  };
  const title = text(/<div class="col-12"><span style="font-size: 28px;[^"]*">([\s\S]*?)<\/span><\/div>/);
  const artist = text(/<div class="col-12"><span style="font-size: 16px;[^"]*">([\s\S]*?)<\/span><\/div>/);
  const character = text(/<div class="col-12 [^"]*-text"><b>([\s\S]*?)<\/b><\/div>/);
  const difficultyText = text(/<span class="[^"]*difffont"[^>]*>([\s\S]*?)<\/span>/);
  const values = [...html.matchAll(/<div class="col-3">([^<]*)<\/div>/g)].map((m) => stripTags(m[1]));
  return {
    title,
    artist,
    character,
    difficultyText,
    bpm: values[0] ? Number(values[0]) : null,
    scanline: values[1] || null,
    combo: values[2] ? Number(values[2]) : null,
    pageCount: values[3] ? Number(values[3]) : null,
  };
}

async function fetchChaosHeader(id) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `${id}.html`);
  if (fs.existsSync(cacheFile)) {
    return parseChartHeader(fs.readFileSync(cacheFile, 'utf8'));
  }
  const url = `${REMOTE_CHART_BASE}/${encodeURIComponent(id)}/chaos.html`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Range: 'bytes=0-16383', 'User-Agent': 'cytus-chart-forum' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const head = html.slice(0, 16384);
      fs.writeFileSync(cacheFile, head, 'utf8');
      return parseChartHeader(head);
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return {};
}

function parseWikiTables(html) {
  const entries = [];
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
  for (const table of tables) {
    const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    if (rows.length < 2) continue;
    const cellsOf = (row) =>
      [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => stripTags(m[1]));
    const header = cellsOf(rows[0]).map((c) => c.toUpperCase());
    if (!header.includes('EASY') || !header.includes('CHAOS')) continue;
    const col = (name) => header.indexOf(name);
    const idx = {
      easy: col('EASY'),
      hard: col('HARD'),
      chaos: col('CHAOS'),
      glitch: col('GLITCH'),
      crash: col('CRASH'),
    };
    for (const row of rows.slice(1)) {
      const cells = cellsOf(row);
      if (cells.length < 4 || !cells[0]) continue;
      const pick = (i) => (i >= 0 && i < cells.length ? cells[i] : null);
      entries.push({
        title: cells[0],
        composer: cells[1] || null,
        easy: pick(idx.easy),
        hard: pick(idx.hard),
        chaos: pick(idx.chaos),
        glitch: pick(idx.glitch),
        crash: pick(idx.crash),
      });
    }
  }
  return entries;
}

async function fetchWiki() {
  const res = await fetch(WIKI_URL, { headers: { 'User-Agent': 'Mozilla/5.0 cytus-chart-forum' } });
  if (!res.ok) throw new Error(`Wiki 请求失败：HTTP ${res.status}`);
  return res.text();
}

function levelValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '－') return null;
  return s;
}

async function main() {
  console.log('1/4 读取本地谱面文件…');
  const local = localSongs();
  console.log(`  本地曲目 ${local.size} 个`);

  console.log('2/4 获取 ct2view 曲目列表…');
  const remoteIds = await remoteSongIds();
  console.log(`  ct2view 曲目 ${remoteIds.length} 个`);

  console.log('3/4 抓取 ct2view 页头（已缓存会跳过）…');
  const headers = await mapPool(remoteIds, concurrency, async (id) => ({
    id,
    ...(await fetchChaosHeader(id)),
  }));
  const headerMap = new Map(headers.filter((h) => !h.error).map((h) => [h.id, h]));
  const failed = headers.filter((h) => h.error);
  console.log(`  成功 ${headerMap.size}，失败 ${failed.length}`);

  console.log('4/4 解析 Wiki 难度表并合并…');
  const wiki = parseWikiTables(await fetchWiki());
  const wikiExact = new Map();
  const wikiLoose = new Map();
  for (const entry of wiki) {
    const key = normalizeTitle(entry.title);
    if (!wikiExact.has(key)) wikiExact.set(key, entry);
    const loose = looseTitle(entry.title);
    if (loose && !wikiLoose.has(loose)) wikiLoose.set(loose, entry);
  }

  const songs = [];
  let wikiMatched = 0;
  const usedRemoteIds = new Set();

  // 本地命名与 ct2view 存在个别前缀差异（graff001_043+ 实际对应 graffj001_0xx）
  const resolveRemoteId = (localId) => {
    if (headerMap.has(localId)) return localId;
    const alias = localId.replace(/^graff001_/, 'graffj001_');
    if (alias !== localId && headerMap.has(alias)) return alias;
    return null;
  };

  for (const [localId, localEntry] of local) {
    const remoteId = resolveRemoteId(localId);
    const h = remoteId ? headerMap.get(remoteId) : null;
    if (remoteId) usedRemoteIds.add(remoteId);
    if (!h || !h.title) {
      const charts = {};
      for (const [idx, file] of Object.entries(localEntry.files)) {
        charts[idx] = {
          difficulty: DIFFICULTY_NAMES[idx] || `UNKNOWN_${idx}`,
          level: null,
          file,
        };
      }
      songs.push({
        id: localId,
        remoteId: remoteId || null,
        title: null,
        artist: null,
        character: null,
        bpm: null,
        scanline: null,
        combo: null,
        pageCount: null,
        chaosLevel: null,
        wikiMatched: false,
        charts,
      });
      continue;
    }
    const wikiEntry = wikiExact.get(normalizeTitle(h.title)) || wikiLoose.get(looseTitle(h.title)) || null;
    if (wikiEntry) wikiMatched += 1;
    const charts = {};
    const levelFor = {
      0: wikiEntry?.easy,
      1: wikiEntry?.hard,
      2: wikiEntry?.chaos,
      3: wikiEntry?.glitch,
      4: wikiEntry?.crash,
    };
    for (const idx of Object.keys(localEntry.files)) {
      charts[idx] = {
        difficulty: DIFFICULTY_NAMES[idx] || `UNKNOWN_${idx}`,
        level: idx === '2' && h.difficultyText?.match(/(\d+\+?)/)
          ? h.difficultyText.match(/(\d+\+?)/)[1]
          : levelValue(levelFor[idx]),
        file: localEntry.files[idx],
      };
    }
    songs.push({
      id: localId,
      remoteId,
      title: h.title,
      artist: h.artist,
      character: h.character,
      bpm: h.bpm,
      scanline: h.scanline,
      combo: h.combo,
      pageCount: h.pageCount,
      chaosLevel: h.difficultyText || null,
      wikiMatched: Boolean(wikiEntry),
      charts,
    });
  }

  // ct2view 有、本地没有的曲目也保留
  for (const id of remoteIds) {
    if (usedRemoteIds.has(id)) continue;
    const h = headerMap.get(id);
    if (!h || !h.title) continue;
    const wikiEntry = wikiExact.get(normalizeTitle(h.title)) || wikiLoose.get(looseTitle(h.title)) || null;
    if (wikiEntry) wikiMatched += 1;
    songs.push({
      id,
      remoteId: id,
      title: h.title,
      artist: h.artist,
      character: h.character,
      bpm: h.bpm,
      scanline: h.scanline,
      combo: h.combo,
      pageCount: h.pageCount,
      chaosLevel: h.difficultyText || null,
      wikiMatched: Boolean(wikiEntry),
      charts: {},
    });
  }
  songs.sort((a, b) => a.id.localeCompare(b.id));

  const missingLocal = songs.filter((s) => !s.title).map((s) => s.id);

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      sources: [
        'https://github.com/KiattipoomR/ct2view (chart header)',
        'https://wikiwiki.jp/cytus-2/楽曲一覧 (difficulty levels)',
      ],
      difficultyNames: DIFFICULTY_NAMES,
      stats: {
        localSongs: local.size,
        ct2viewSongs: remoteIds.length,
        ct2viewFetched: headerMap.size,
        ct2viewFailed: failed.length,
        wikiEntries: wiki.length,
        wikiMatched,
        localMissingMetadata: missingLocal.length,
      },
      failedIds: failed.map((f) => f.id),
      missingLocalIds: missingLocal,
    },
    songs,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('\n完成');
  console.log(`  索引文件：${outFile}`);
  console.log(`  曲目总数：${songs.length}（其中元数据缺失 ${missingLocal.length}）`);
  console.log(`  Wiki 匹配：${wikiMatched}/${headerMap.size}`);
  if (failed.length) console.log(`  抓取失败：${failed.length}，可重跑补齐`);
}

await main();
