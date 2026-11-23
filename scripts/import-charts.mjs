import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { pinyin } from 'pinyin-pro';

const prisma = new PrismaClient();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
}

const limit = args.includes('--all') ? Infinity : Math.max(1, Number(argValue('--limit', '30')) || 30);
const metadataPath = path.resolve(root, argValue('--metadata', 'data/metadata/songs.json'));
const aliasesPath = path.resolve(root, argValue('--aliases', 'data/metadata/aliases.json'));
const dataDir = path.resolve(root, argValue('--data-dir', path.join('..', 'Cytus II谱面数据', 'Cytus II 全谱面 5.3')));
const reset = args.includes('--reset');

if (!fs.existsSync(metadataPath)) {
  console.error(`找不到元数据文件：${metadataPath}`);
  process.exit(1);
}
if (!fs.existsSync(dataDir)) {
  console.error(`找不到谱面目录：${dataDir}`);
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const aliases = fs.existsSync(aliasesPath) ? JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) : {};
const candidates = (metadata.songs || []).filter((s) => s.charts && Object.keys(s.charts).length > 0);
const selected = candidates.slice(0, limit);

function pinyinFields(title) {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const pinyinFull = normalize(pinyin(title, { toneType: 'none', type: 'array' }).join(''));
  const pinyinInitials = title
    .split(/\s+/)
    .map((token) => {
      if (/^[A-Za-z0-9]+$/.test(token)) return token[0].toLowerCase();
      return normalize(pinyin(token, { pattern: 'first', toneType: 'none', type: 'array' }).join(''));
    })
    .join('');
  return { pinyinFull, pinyinInitials };
}

console.log(`元数据：${candidates.length} 首可导入，本次导入 ${selected.length} 首`);
console.log(`谱面目录：${dataDir}`);

let songCount = 0;
let chartCount = 0;
let aliasCount = 0;
let pageTotal = 0;
let noteTotal = 0;
const skipped = [];

try {
  if (reset) {
    await prisma.chart.deleteMany();
    await prisma.alias.deleteMany();
    await prisma.song.deleteMany();
    console.log('已清空 songs / charts / aliases');
  }

  for (const song of selected) {
    const songData = {
      title: song.title || song.id,
      artist: song.artist || 'Unknown',
      character: song.character || null,
      category: song.category || null,
      bpm: Number.isFinite(song.bpm) ? song.bpm : null,
      metadataSource: 'ct2view + CytusII Wiki',
      ...pinyinFields(song.title || song.id),
    };

    await prisma.song.upsert({
      where: { id: song.id },
      create: { id: song.id, ...songData },
      update: songData,
    });
    songCount += 1;

    for (const alias of aliases[song.id] || []) {
      if (typeof alias !== 'string' || !alias.trim()) continue;
      await prisma.alias.upsert({
        where: { songId_alias: { songId: song.id, alias } },
        create: { songId: song.id, alias, source: 'aliases.json' },
        update: { source: 'aliases.json' },
      });
      aliasCount += 1;
    }

    const entries = Object.entries(song.charts).sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [index, chart] of entries) {
      const chartPath = path.join(dataDir, chart.file);
      if (!fs.existsSync(chartPath)) {
        skipped.push(`${song.id} ${chart.file}（文件不存在）`);
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
      } catch (err) {
        skipped.push(`${song.id} ${chart.file}（解析失败：${err.message}）`);
        continue;
      }

      const pageCount = Array.isArray(parsed.page_list) ? parsed.page_list.length : 0;
      const noteCount = Array.isArray(parsed.note_list) ? parsed.note_list.length : 0;
      const difficultyIndex = Number(index);

      await prisma.chart.upsert({
        where: { songId_difficultyIndex: { songId: song.id, difficultyIndex } },
        create: {
          id: chart.file.replace(/\.json$/, ''),
          songId: song.id,
          difficultyIndex,
          difficultyName: chart.difficulty || `DIFF ${difficultyIndex}`,
          difficultyLevel: chart.level ? String(chart.level) : null,
          jsonFile: chart.file,
          pageCount,
          noteCount,
        },
        update: {
          difficultyName: chart.difficulty || `DIFF ${difficultyIndex}`,
          difficultyLevel: chart.level ? String(chart.level) : null,
          jsonFile: chart.file,
          pageCount,
          noteCount,
        },
      });

      chartCount += 1;
      pageTotal += pageCount;
      noteTotal += noteCount;
    }
  }

  console.log(`导入完成：${songCount} 首曲目，${chartCount} 张谱面，${aliasCount} 个别名，${pageTotal} 页，${noteTotal} 个音符`);
  if (skipped.length > 0) {
    console.log(`跳过 ${skipped.length} 个谱面：`);
    for (const item of skipped) console.log(`  - ${item}`);
  }
} finally {
  await prisma.$disconnect();
}
