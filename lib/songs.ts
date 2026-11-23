import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type SongWithCharts = Prisma.SongGetPayload<{
  include: { charts: true; aliases: true };
}>;

const include = {
  charts: { orderBy: { difficultyIndex: 'asc' as const } },
  aliases: { orderBy: { alias: 'asc' as const } },
};

export type SongSearchFilters = {
  characters?: string[];
  minDifficulty?: number;
  maxDifficulty?: number;
};

/** 难度文本转数值：13 -> 13，11+ -> 11.5（兼容全角＋），其余返回 null */
function difficultyScore(level: string | null): number | null {
  if (!level) return null;
  const match = level.trim().match(/^(\d+)(\+|＋)?$/);
  if (!match) return null;
  return Number(match[1]) + (match[2] ? 0.5 : 0);
}

export type SongSearchResult = {
  songs: SongWithCharts[];
  total: number;
};

export async function searchSongs(
  query: string,
  filters: SongSearchFilters = {},
): Promise<SongSearchResult> {
  const keyword = query.trim();
  const normalized = keyword.toLowerCase().replace(/\s+/g, '');
  const where: Prisma.SongWhereInput = {};

  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { artist: { contains: keyword } },
      { character: { contains: keyword } },
      { pinyinFull: { contains: normalized } },
      { pinyinInitials: { contains: normalized } },
      { aliases: { some: { alias: { contains: keyword } } } },
    ];
  }

  const characters = filters.characters ?? [];
  if (characters.length > 0) {
    where.character = { in: characters };
  }

  const min = filters.minDifficulty ?? 1;
  const max = filters.maxDifficulty ?? 16;
  const narrowed = min > 1 || max < 16;
  const limit = keyword ? 30 : 24;

  const songs = await prisma.song.findMany({
    where,
    include,
    orderBy: { title: 'asc' },
    ...(narrowed ? {} : { take: limit }),
  });

  if (!narrowed) {
    const total = await prisma.song.count({ where });
    return { songs, total };
  }

  const filtered = songs.filter((song) =>
    song.charts.some((chart) => {
      const score = difficultyScore(chart.difficultyLevel);
      return score !== null && score >= min && score <= max;
    }),
  );
  return { songs: filtered.slice(0, limit), total: filtered.length };
}

export async function getCharacters(): Promise<string[]> {
  const rows = await prisma.song.findMany({
    where: { character: { not: null } },
    select: { character: true },
    distinct: ['character'],
    orderBy: { character: 'asc' },
  });
  return rows
    .map((row) => row.character)
    .filter((value): value is string => Boolean(value && value.trim()));
}

export async function getSong(id: string): Promise<SongWithCharts | null> {
  return prisma.song.findUnique({ where: { id }, include });
}

export async function getSongCount(): Promise<number> {
  return prisma.song.count();
}
