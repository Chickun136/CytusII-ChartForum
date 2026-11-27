import { canHandleReport } from './permissions';
import { prisma } from './prisma';
import { formatDateTime } from './time';

export async function getActiveMute(userId: string) {
  return prisma.report.findFirst({
    where: { comment: { userId }, muteUntil: { gt: new Date() } },
    orderBy: { muteUntil: 'desc' },
    select: { muteUntil: true, muteDays: true },
  });
}

export type ReportEntryView = {
  id: string;
  content: string;
  reporterNickname: string;
  createdAtLabel: string;
};

export type ReportGroupView = {
  commentId: string;
  songId: string;
  songTitle: string;
  commentContent: string;
  author: { id: string; nickname: string; role: string };
  reports: ReportEntryView[];
  pendingCount: number;
  earliestOrder: string;
  earliestLabel: string;
  canHandle: boolean;
};

export async function getReportQueue(actor: { id: string; role: string }) {
  const rows = await prisma.report.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      reporter: { select: { nickname: true } },
      comment: {
        select: {
          id: true,
          content: true,
          imageUrl: true,
          deletedAt: true,
          song: { select: { id: true, title: true } },
          user: { select: { id: true, nickname: true, role: true } },
        },
      },
    },
  });

  const groups = new Map<string, ReportGroupView>();
  for (const row of rows) {
    const existing = groups.get(row.commentId);
    const entry: ReportEntryView = {
      id: row.id,
      content: row.content,
      reporterNickname: row.reporter.nickname,
      createdAtLabel: formatDateTime(row.createdAt),
    };

    if (existing) {
      existing.reports.push(entry);
      existing.pendingCount += 1;
      continue;
    }

    groups.set(row.commentId, {
      commentId: row.comment.id,
      songId: row.comment.song.id,
      songTitle: row.comment.song.title,
      commentContent: row.comment.deletedAt
        ? '该评论已被管理员删除'
        : row.comment.content || (row.comment.imageUrl ? '[图片]' : ''),
      author: row.comment.user,
      reports: [entry],
      pendingCount: 1,
      earliestOrder: row.createdAt.toISOString(),
      earliestLabel: formatDateTime(row.createdAt),
      canHandle: canHandleReport(actor.role, row.comment.user.role),
    });
  }

  return [...groups.values()].sort((a, b) => a.earliestOrder.localeCompare(b.earliestOrder));
}

export type MyReportView = {
  id: string;
  content: string;
  status: string;
  statusLabel: string;
  createdAtLabel: string;
  handledAtLabel: string | null;
  resolution: string | null;
  muteUntilLabel: string | null;
  handledByNickname: string | null;
  comment: {
    id: string;
    songId: string;
    songTitle: string;
    content: string;
    deleted: boolean;
  };
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  RESOLVED: '已处理 · 违规',
  DISMISSED: '已处理 · 不违规',
};

export function reportStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export async function getMyReports(userId: string): Promise<MyReportView[]> {
  const rows = await prisma.report.findMany({
    where: { reporterId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      comment: {
        select: {
          id: true,
          content: true,
          imageUrl: true,
          deletedAt: true,
          song: { select: { id: true, title: true } },
        },
      },
      handledBy: { select: { nickname: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    status: row.status,
    statusLabel: reportStatusLabel(row.status),
    createdAtLabel: formatDateTime(row.createdAt),
    handledAtLabel: row.handledAt ? formatDateTime(row.handledAt) : null,
    resolution: row.resolution,
    muteUntilLabel: row.muteUntil ? formatDateTime(row.muteUntil) : null,
    handledByNickname: row.handledBy?.nickname ?? null,
    comment: {
      id: row.comment.id,
      songId: row.comment.song.id,
      songTitle: row.comment.song.title,
      content: row.comment.deletedAt
        ? '该评论已被管理员删除'
        : row.comment.content || (row.comment.imageUrl ? '[图片]' : ''),
      deleted: Boolean(row.comment.deletedAt),
    },
  }));
}
