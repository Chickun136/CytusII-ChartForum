import { prisma } from './prisma';

export type ChartRatingSummary = {
  average: number;
  count: number;
  mine: number;
};

export async function getChartRatings(
  chartIds: string[],
  userId?: string,
): Promise<Record<string, ChartRatingSummary>> {
  const result: Record<string, ChartRatingSummary> = {};
  for (const chartId of chartIds) {
    result[chartId] = { average: 0, count: 0, mine: 0 };
  }
  if (chartIds.length === 0) return result;

  const [groups, mineRows] = await Promise.all([
    prisma.chartRating.groupBy({
      by: ['chartId'],
      where: { chartId: { in: chartIds } },
      _avg: { score: true },
      _count: { _all: true },
    }),
    userId
      ? prisma.chartRating.findMany({
          where: { userId, chartId: { in: chartIds } },
          select: { chartId: true, score: true },
        })
      : Promise.resolve([]),
  ]);

  for (const group of groups) {
    const entry = result[group.chartId];
    if (!entry) continue;
    entry.average = group._avg.score ?? 0;
    entry.count = group._count._all;
  }
  for (const row of mineRows) {
    const entry = result[row.chartId];
    if (entry) entry.mine = row.score;
  }

  return result;
}
