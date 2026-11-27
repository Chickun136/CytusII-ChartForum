import { prisma } from './prisma';
import { formatRelativeTime } from './time';

export type NotificationType = 'LIKE' | 'REPLY' | 'REPORT_RESULT' | 'MODERATION';

export type NotificationView = {
  id: string;
  type: NotificationType;
  isRead: boolean;
  timeLabel: string;
  actor: {
    nickname: string;
    avatarUrl: string | null;
  };
  comment: {
    id: string;
    content: string;
    songId: string;
    songTitle: string;
    deleted: boolean;
  };
  count: number;
};

export function normalizeNotificationType(value: string): NotificationType {
  if (value === 'REPLY') return 'REPLY';
  if (value === 'REPORT_RESULT') return 'REPORT_RESULT';
  if (value === 'MODERATION') return 'MODERATION';
  return 'LIKE';
}

export async function getNotifications(userId: string) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { nickname: true, avatarUrl: true } },
        comment: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            deletedAt: true,
            song: { select: { id: true, title: true } },
            _count: { select: { likes: true, replies: true } },
          },
        },
      },
    }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
  ]);

  const items: NotificationView[] = rows.map((row) => {
    const type = normalizeNotificationType(row.type);
    return {
      id: row.id,
      type,
      isRead: row.isRead,
      timeLabel: formatRelativeTime(row.createdAt.toISOString()),
      actor: row.actor,
      comment: {
        id: row.comment.id,
        content: row.comment.deletedAt
          ? '该评论已被管理员删除'
          : row.comment.content || (row.comment.imageUrl ? '[图片]' : ''),
        songId: row.comment.song.id,
        songTitle: row.comment.song.title,
        deleted: Boolean(row.comment.deletedAt),
      },
      count:
        type === 'LIKE'
          ? row.comment._count.likes
          : type === 'REPLY'
            ? row.comment._count.replies
            : 1,
    };
  });

  return { items, unreadCount };
}
