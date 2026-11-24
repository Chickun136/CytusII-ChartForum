import { prisma } from './prisma';
import { formatRelativeTime } from './time';

export type NotificationView = {
  id: string;
  type: 'LIKE' | 'REPLY';
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
  };
  count: number;
};

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
            song: { select: { id: true, title: true } },
            _count: { select: { likes: true, replies: true } },
          },
        },
      },
    }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
  ]);

  const items: NotificationView[] = rows.map((row) => ({
    id: row.id,
    type: row.type === 'REPLY' ? 'REPLY' : 'LIKE',
    isRead: row.isRead,
    timeLabel: formatRelativeTime(row.createdAt.toISOString()),
    actor: row.actor,
    comment: {
      id: row.comment.id,
      content: row.comment.content,
      songId: row.comment.song.id,
      songTitle: row.comment.song.title,
    },
    count: row.type === 'LIKE' ? row.comment._count.likes : row.comment._count.replies,
  }));

  return { items, unreadCount };
}
