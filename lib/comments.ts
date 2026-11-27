import { prisma } from './prisma';

export type CommentAuthor = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
};

export type CommentView = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: CommentAuthor;
  likeCount: number;
  likedByMe: boolean;
  deleted: boolean;
  deletedBySelf: boolean;
  replies: CommentView[];
};

type CommentRow = {
  id: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
  user: CommentAuthor;
  likes: { userId: string }[];
  replies?: CommentRow[];
};

function toView(row: CommentRow, viewerId?: string): CommentView {
  const deleted = Boolean(row.deletedAt);
  return {
    id: row.id,
    content: deleted ? '' : row.content,
    imageUrl: deleted ? null : row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    author: row.user,
    likeCount: row.likes.length,
    likedByMe: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
    deleted,
    deletedBySelf: deleted && row.deletedById === row.userId,
    replies: [],
  };
}

export async function getSongComments(songId: string, viewerId?: string): Promise<CommentView[]> {
  const rows = await prisma.comment.findMany({
    where: { songId, parentId: null },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true, role: true } },
      likes: { select: { userId: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, nickname: true, avatarUrl: true, role: true } },
          likes: { select: { userId: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    ...toView(row, viewerId),
    replies: row.deletedAt ? [] : (row.replies ?? []).map((reply) => toView(reply, viewerId)),
  }));
}
