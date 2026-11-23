import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type SongWithCharts = Prisma.SongGetPayload<{
  include: { charts: true; aliases: true };
}>;

const include = {
  charts: { orderBy: { difficultyIndex: 'asc' as const } },
  aliases: { orderBy: { alias: 'asc' as const } },
};

export async function searchSongs(query: string, take = 30): Promise<SongWithCharts[]> {
  const keyword = query.trim();
  if (!keyword) {
    return prisma.song.findMany({
      include,
      orderBy: { title: 'asc' },
      take: 24,
    });
  }

  const normalized = keyword.toLowerCase().replace(/\s+/g, '');

  return prisma.song.findMany({
    where: {
      OR: [
        { title: { contains: keyword } },
        { artist: { contains: keyword } },
        { character: { contains: keyword } },
        { pinyinFull: { contains: normalized } },
        { pinyinInitials: { contains: normalized } },
        { aliases: { some: { alias: { contains: keyword } } } },
      ],
    },
    include,
    orderBy: { title: 'asc' },
    take,
  });
}

export async function getSong(id: string): Promise<SongWithCharts | null> {
  return prisma.song.findUnique({ where: { id }, include });
}

export async function getSongCount(): Promise<number> {
  return prisma.song.count();
}
