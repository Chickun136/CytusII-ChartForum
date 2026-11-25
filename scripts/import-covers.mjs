import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')
    ? args[index + 1]
    : fallback;
}

const sourceDir = path.resolve(
  root,
  argValue(
    '--source',
    process.env.COVER_SOURCE_DIR || path.join('..', 'Cytus II谱面数据', 'Cytus II 全曲绘 5.3'),
  ),
);
const outputDir = path.resolve(
  root,
  argValue('--out', process.env.COVER_OUTPUT_DIR || path.join('public', 'covers')),
);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const OUTPUT_EXTS = ['webp', 'png', 'jpg', 'jpeg', 'gif'];

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('未安装 sharp：将直接复制原图（输出体积较大）。');
}

if (!fs.existsSync(sourceDir)) {
  console.error(`找不到曲绘目录：${sourceDir}`);
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function score(file) {
  const relative = path.relative(sourceDir, file);
  const folder = relative.split(path.sep)[0];
  const ext = path.extname(file).toLowerCase();
  let value = 0;
  if (folder === 'square') value += 4; // 正方形曲绘优先：与卡片 1:1 窗口一致
  if (ext === '.png') value += 2;
  else if (ext === '.jpg' || ext === '.jpeg' || ext === '.webp') value += 1;
  return value;
}

const coverMap = new Map();
for (const file of walk(sourceDir)) {
  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) continue;
  const key = path.basename(file, path.extname(file));
  const existing = coverMap.get(key);
  if (!existing || score(file) > score(existing)) {
    coverMap.set(key, file);
  }
}

console.log(`曲绘源目录：${sourceDir}`);
console.log(`可用曲绘：${coverMap.size} 张`);
console.log(`输出目录：${outputDir}${dryRun ? '（dry-run，不写文件）' : ''}`);

const songs = await prisma.song.findMany({
  select: { id: true, title: true },
  orderBy: { orderIndex: 'asc' },
});
const songIds = new Set(songs.map((song) => song.id));
const unusedCovers = [...coverMap.keys()].filter((key) => !songIds.has(key));

if (!dryRun) fs.mkdirSync(outputDir, { recursive: true });

const unmatched = [];
const updates = [];
let converted = 0;
let reused = 0;

for (const song of songs) {
  const source = coverMap.get(song.id);
  if (!source) {
    unmatched.push(song);
    continue;
  }

  const ext = sharp ? '.webp' : path.extname(source).toLowerCase();
  const output = path.join(outputDir, `${song.id}${ext}`);

  if (!dryRun) {
    for (const candidate of OUTPUT_EXTS) {
      const stale = path.join(outputDir, `${song.id}.${candidate}`);
      if (stale !== output && fs.existsSync(stale)) fs.rmSync(stale);
    }
  }

  const outputExists = fs.existsSync(output);
  const outputFresh =
    outputExists && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs;

  if (!dryRun && (!outputFresh || force)) {
    if (sharp) {
      await sharp(source)
        .rotate()
        .resize({
          width: 512,
          height: 512,
          fit: 'cover',
          position: 'center',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toFile(output);
      converted += 1;
    } else {
      fs.copyFileSync(source, output);
      converted += 1;
    }
  } else {
    reused += 1;
  }

  updates.push({
    id: song.id,
    coverUrl: `/covers/${song.id}${ext}`,
  });

  if (updates.length % 100 === 0) {
    console.log(`已处理 ${updates.length}/${songs.length}`);
  }
}

if (!dryRun && updates.length > 0) {
  for (let index = 0; index < updates.length; index += 100) {
    const batch = updates.slice(index, index + 100);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.song.update({
          where: { id: item.id },
          data: { coverUrl: item.coverUrl },
        }),
      ),
    );
  }
}

let outputSize = 0;
let outputCount = 0;
if (!dryRun && fs.existsSync(outputDir)) {
  for (const name of fs.readdirSync(outputDir)) {
    const full = path.join(outputDir, name);
    if (fs.statSync(full).isFile()) {
      outputSize += fs.statSync(full).size;
      outputCount += 1;
    }
  }
}

console.log('---- 结果 ----');
console.log(`曲目：${songs.length}，匹配：${updates.length}，未匹配：${unmatched.length}`);
console.log(`转换：${converted}，复用：${reused}`);
if (!dryRun) {
  console.log(`输出：${outputCount} 个文件，${(outputSize / 1024 / 1024).toFixed(1)} MB`);
}
if (unusedCovers.length > 0) {
  console.log(`未对应曲目的曲绘：${unusedCovers.length} 张（${unusedCovers.slice(0, 10).join('、')}）`);
}
if (unmatched.length > 0) {
  console.log('未匹配曲目（前 20 个）：');
  for (const song of unmatched.slice(0, 20)) {
    console.log(`- ${song.id} ${song.title}`);
  }
}

await prisma.$disconnect();
