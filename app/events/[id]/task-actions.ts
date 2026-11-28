'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { saveCommentImage } from '@/lib/comment-image';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/roles';

const MAX_LENGTH = 500;

export type EventCommentActionState = { error?: string } | null;

async function readPublishedEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, startAt: true, endAt: true },
  });
  if (!event || event.status !== 'PUBLISHED') return null;
  return event;
}

export async function createEventCommentAction(
  _prev: EventCommentActionState,
  formData: FormData,
): Promise<EventCommentActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const eventId = String(formData.get('eventId') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const image = formData.get('image');

  if (!eventId) return { error: '缺少活动信息。' };
  if (content.length > MAX_LENGTH) {
    return { error: `评论不能超过 ${MAX_LENGTH} 个字符。` };
  }

  const hasImage = image instanceof File && image.size > 0;
  if (!content && !hasImage) return { error: '请输入评论内容或选择图片。' };

  const event = await readPublishedEvent(eventId);
  if (!event) return { error: '活动不存在或未发布。' };
  if (event.endAt.getTime() < Date.now()) return { error: '活动已结束，无法继续参与。' };

  let imageUrl: string | null = null;
  if (hasImage) {
    try {
      imageUrl = await saveCommentImage(image);
    } catch (error) {
      return { error: error instanceof Error ? error.message : '图片上传失败。' };
    }
  }

  await prisma.eventComment.create({
    data: { eventId, userId: user.id, content, imageUrl },
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}#task-comments`);
}

export async function submitEventTaskAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  if (!commentId) return;

  const comment = await prisma.eventComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      eventId: true,
      userId: true,
      imageUrl: true,
      status: true,
      event: { select: { status: true, endAt: true } },
    },
  });
  if (!comment || comment.userId !== user.id) return;
  if (comment.event.status !== 'PUBLISHED') return;
  if (comment.event.endAt.getTime() < Date.now()) return;
  if (!comment.imageUrl) return;
  if (comment.status === 'PENDING' || comment.status === 'APPROVED') return;

  await prisma.eventComment.update({
    where: { id: commentId },
    data: { status: 'PENDING', submittedAt: new Date(), reviewedById: null, reviewedAt: null, reviewNote: null },
  });

  revalidatePath(`/events/${comment.eventId}`);
  revalidatePath('/admin');
}

export async function reviewEventTaskAction(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor || !canAccessAdmin(actor.role)) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '');
  const noteRaw = String(formData.get('reviewNote') ?? '').trim();
  if (!commentId || (decision !== 'approve' && decision !== 'reject')) return;

  const comment = await prisma.eventComment.findUnique({
    where: { id: commentId },
    select: { id: true, eventId: true, userId: true, status: true },
  });
  if (!comment || comment.status !== 'PENDING') return;

  const now = new Date();
  const reviewNote = noteRaw ? noteRaw.slice(0, 200) : null;

  if (decision === 'approve') {
    const already = await prisma.eventComment.findFirst({
      where: {
        eventId: comment.eventId,
        userId: comment.userId,
        status: 'APPROVED',
        id: { not: commentId },
      },
      select: { id: true },
    });
    if (already) {
      await prisma.eventComment.update({
        where: { id: commentId },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: now,
          reviewNote: '该用户已在本次活动中通过其他提交获得奖励。',
        },
      });
      revalidatePath('/admin');
      revalidatePath(`/events/${comment.eventId}`);
      redirect('/admin?tab=tasks&notice=rejected');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventComment.update({
      where: { id: commentId },
      data: {
        status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedById: actor.id,
        reviewedAt: now,
        reviewNote,
      },
    });

    if (decision === 'approve') {
      await tx.user.update({
        where: { id: comment.userId },
        data: { capso: { increment: 1 } },
      });
    }
  });

  revalidatePath('/admin');
  revalidatePath(`/events/${comment.eventId}`);
  redirect(`/admin?tab=tasks&notice=${decision === 'approve' ? 'approved' : 'rejected'}`);
}
