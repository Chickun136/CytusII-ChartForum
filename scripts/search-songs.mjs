import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const keyword = process.argv.slice(2).join(' ').trim();

if (!keyword) {
  console.error('用法：node scripts/search-songs.mjs <歌名 / 艺术家 / 外号>');
  process.exit(1);
}

try {
  const songs = await prisma.song.findMany({
    where: {
      OR: [
        { title: { contains: keyword } },
        { artist: { contains: keyword } },
        { character: { contains: keyword } },
        { aliases: { some: { alias: { contains: keyword } } } },
      ],
    },
    include: { charts: { orderBy: { difficultyIndex: 'asc' } } },
    orderBy: { title: 'asc' },
    take: 20,
  });

  console.log(`关键字「${keyword}」命中 ${songs.length} 首（最多显示 20 首）`);
  for (const song of songs) {
    console.log(`\n${song.title} — ${song.artist}`);
    if (song.character) console.log(`  角色：${song.character}`);
    for (const chart of song.charts) {
      const level = chart.difficultyLevel ? ` ${chart.difficultyLevel}` : '';
      console.log(`  ${chart.difficultyName}${level}：${chart.pageCount} 页 / ${chart.noteCount} 音符（${chart.jsonFile}）`);
    }
  }

  if (songs.length === 0) {
    console.log('未找到匹配曲目，可先运行 node scripts/import-charts.mjs 导入数据。');
  }
} finally {
  await prisma.$disconnect();
}
