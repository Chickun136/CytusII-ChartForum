import { prisma } from './prisma';

export type CommentAuthor = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type CommentView = {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
  likeCount: number;
  likedByMe: boolean;
  replies: CommentView[];
};

type CommentRow = {
  id: string;
  content: string;
  createdAt: Date;
  user: CommentAuthor;
  likes: { userId: string }[];
  replies?: CommentRow[];
};

function toView(row: CommentRow, viewerId?: string): CommentView {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    author: row.user,
    likeCount: row.likes.length,
    likedByMe: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
    replies: [],
  };
}

export async function getSongComments(songId: string, viewerId?: string): Promise<CommentView[]> {
  const rows = await prisma.comment.findMany({
    where: { songId, parentId: null },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      likes: { select: { userId: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, nickname: true, avatarUrl: true } },
          likes: { select: { userId: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    ...toView(row, viewerId),
    replies: (row.replies ?? []).map((reply) => toView(reply, viewerId)),
  }));
}
