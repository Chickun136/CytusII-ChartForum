'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type RateChartResult =
  | { ok: true; average: number; count: number; mine: number }
  | { ok: false; error: string };

export async function rateChart(chartId: string, score: number): Promise<RateChartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录后再评分' };

  const value = Math.round(score);
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    return { ok: false, error: '评分需要是 1 到 5 星' };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true },
  });
  if (!chart) return { ok: false, error: '谱面不存在' };

  await prisma.chartRating.upsert({
    where: { chartId_userId: { chartId, userId: user.id } },
    create: { chartId, userId: user.id, score: value },
    update: { score: value },
  });

  const aggregate = await prisma.chartRating.aggregate({
    where: { chartId },
    _avg: { score: true },
    _count: { _all: true },
  });

  return {
    ok: true,
    average: aggregate._avg.score ?? 0,
    count: aggregate._count._all,
    mine: value,
  };
}
