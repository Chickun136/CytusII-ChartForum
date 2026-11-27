'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { saveCommentImage } from '@/lib/comment-image';
import { getActiveMute } from '@/lib/moderation';
import { canDeleteComment } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/time';

const MAX_COMMENT_LENGTH = 500;

export type CommentActionState = { error?: string } | null;

export async function createCommentAction(
  _prev: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const mute = await getActiveMute(user.id);
  if (mute?.muteUntil) {
    return {
      error: `您已被限制评论功能，${formatDateTime(mute.muteUntil)} 后方可正常发布评论。`,
    };
  }

  const songId = String(formData.get('songId') ?? '').trim();
  const parentIdRaw = String(formData.get('parentId') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const image = formData.get('image');

  if (!songId) return { error: '缺少曲目信息。' };
  if (content.length > MAX_COMMENT_LENGTH) {
    return { error: `评论不能超过 ${MAX_COMMENT_LENGTH} 个字符。` };
  }

  const hasImage = image instanceof File && image.size > 0;
  if (!content && !hasImage) return { error: '请输入评论内容或选择图片。' };

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) return { error: '曲目不存在。' };

  let parentId: string | null = null;
  let notifyUserId: string | null = null;
  let notifyCommentId: string | null = null;

  if (parentIdRaw) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentIdRaw },
      select: { id: true, songId: true, userId: true, parentId: true, deletedAt: true },
    });
    if (!parent || parent.songId !== songId) return { error: '回复的评论不存在。' };
    if (parent.deletedAt) return { error: '回复的评论已被删除。' };

    parentId = parent.parentId ?? parent.id;
    if (parent.parentId) {
      const root = await prisma.comment.findUnique({
        where: { id: parent.parentId },
        select: { id: true, userId: true },
      });
      notifyUserId = root?.userId ?? parent.userId;
      notifyCommentId = root?.id ?? parent.id;
    } else {
      notifyUserId = parent.userId;
      notifyCommentId = parent.id;
    }
  }

  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await saveCommentImage(image);
    } catch (error) {
      return { error: error instanceof Error ? error.message : '图片上传失败。' };
    }
  }

  const comment = await prisma.comment.create({
    data: { songId, userId: user.id, parentId, content, imageUrl },
  });

  if (notifyUserId && notifyCommentId && notifyUserId !== user.id) {
    await prisma.notification.upsert({
      where: {
        recipientId_type_commentId: {
          recipientId: notifyUserId,
          type: 'REPLY',
          commentId: notifyCommentId,
        },
      },
      create: {
        recipientId: notifyUserId,
        actorId: user.id,
        type: 'REPLY',
        commentId: notifyCommentId,
      },
      update: { actorId: user.id, isRead: false, createdAt: new Date() },
    });
  }

  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}#comment-${parentId ?? comment.id}`);
}

export async function deleteCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  if (!commentId) return;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      songId: true,
      userId: true,
      parentId: true,
      deletedAt: true,
      user: { select: { role: true } },
    },
  });
  if (!comment || comment.deletedAt) return;
  if (!canDeleteComment(user, { userId: comment.userId, authorRole: comment.user.role })) {
    return;
  }

  const now = new Date();
  const replies = await prisma.comment.findMany({
    where: { parentId: comment.id },
    select: { id: true },
  });
  const ids = [comment.id, ...replies.map((reply) => reply.id)];

  await prisma.$transaction([
    prisma.comment.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: now, deletedById: user.id, deleteReason: 'MANUAL' },
    }),
    prisma.report.updateMany({
      where: { commentId: { in: ids }, status: 'PENDING' },
      data: {
        status: 'RESOLVED',
        handledById: user.id,
        handledAt: now,
        resolution: '评论已被删除',
      },
    }),
    prisma.notification.deleteMany({
      where: { commentId: { in: ids }, type: { in: ['LIKE', 'REPLY'] } },
    }),
  ]);

  revalidatePath(`/songs/${comment.songId}`);
  revalidatePath('/account');
  revalidatePath('/admin');
}

export async function toggleCommentLikeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  if (!commentId) return;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, songId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) return;

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId: user.id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    if (comment.userId !== user.id) {
      const latest = await prisma.commentLike.findFirst({
        where: { commentId },
        orderBy: { createdAt: 'desc' },
        select: { userId: true },
      });
      if (latest) {
        await prisma.notification.updateMany({
          where: { recipientId: comment.userId, type: 'LIKE', commentId },
          data: { actorId: latest.userId },
        });
      } else {
        await prisma.notification.deleteMany({
          where: { recipientId: comment.userId, type: 'LIKE', commentId },
        });
      }
    }
  } else {
    await prisma.commentLike.create({ data: { commentId, userId: user.id } });
    if (comment.userId !== user.id) {
      await prisma.notification.upsert({
        where: {
          recipientId_type_commentId: {
            recipientId: comment.userId,
            type: 'LIKE',
            commentId,
          },
        },
        create: {
          recipientId: comment.userId,
          actorId: user.id,
          type: 'LIKE',
          commentId,
        },
        update: { actorId: user.id, isRead: false, createdAt: new Date() },
      });
    }
  }

  revalidatePath(`/songs/${comment.songId}`);
}
