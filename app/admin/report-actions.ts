'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canHandleReport } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/roles';

const MUTE_OPTIONS = new Set([1, 3, 7]);

export async function handleReportAction(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor || !canAccessAdmin(actor.role)) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  const action = String(formData.get('action') ?? 'dismiss');
  const resolutionRaw = String(formData.get('resolution') ?? '').trim();
  const muteDaysRaw = Number(formData.get('muteDays') ?? 0);

  if (!commentId) redirect('/admin?tab=reports&error=report_missing');
  if (!['dismiss', 'delete', 'delete_mute'].includes(action)) {
    redirect('/admin?tab=reports&error=report_action');
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      songId: true,
      userId: true,
      deletedAt: true,
      user: { select: { role: true } },
    },
  });
  if (!comment) redirect('/admin?tab=reports&error=report_missing');
  if (!canHandleReport(actor.role, comment.user.role)) {
    redirect('/admin?tab=reports&error=report_forbidden');
  }

  const violation = action !== 'dismiss';
  let muteDays: number | null = null;
  if (action === 'delete_mute') {
    if (!MUTE_OPTIONS.has(muteDaysRaw)) redirect('/admin?tab=reports&error=report_mute');
    muteDays = muteDaysRaw;
  }

  const now = new Date();
  const muteUntil = muteDays ? new Date(now.getTime() + muteDays * 24 * 60 * 60 * 1000) : null;
  const resolution = resolutionRaw ? resolutionRaw.slice(0, 200) : null;

  const pending = await prisma.report.findMany({
    where: { commentId, status: 'PENDING' },
    select: { reporterId: true },
  });
  if (pending.length === 0) redirect('/admin?tab=reports&error=report_handled');

  await prisma.$transaction(async (tx) => {
    if (violation) {
      await tx.comment.updateMany({
        where: { id: commentId, deletedAt: null },
        data: {
          deletedAt: now,
          deletedById: actor.id,
          deleteReason: action === 'delete_mute' ? 'MUTE' : 'MODERATION',
        },
      });
      await tx.notification.deleteMany({
        where: { commentId, type: { in: ['LIKE', 'REPLY'] } },
      });
    }

    await tx.report.updateMany({
      where: { commentId, status: 'PENDING' },
      data: {
        status: violation ? 'RESOLVED' : 'DISMISSED',
        handledById: actor.id,
        handledAt: now,
        resolution,
        muteDays,
        muteUntil,
      },
    });

    const reporters = [...new Set(pending.map((report) => report.reporterId))];
    for (const recipientId of reporters) {
      await tx.notification.upsert({
        where: {
          recipientId_type_commentId: {
            recipientId,
            type: 'REPORT_RESULT',
            commentId,
          },
        },
        create: { recipientId, actorId: actor.id, type: 'REPORT_RESULT', commentId },
        update: { actorId: actor.id, isRead: false, createdAt: now },
      });
    }

    if (violation && comment.userId !== actor.id) {
      await tx.notification.upsert({
        where: {
          recipientId_type_commentId: {
            recipientId: comment.userId,
            type: 'MODERATION',
            commentId,
          },
        },
        create: { recipientId: comment.userId, actorId: actor.id, type: 'MODERATION', commentId },
        update: { actorId: actor.id, isRead: false, createdAt: now },
      });
    }
  });

  revalidatePath('/admin');
  revalidatePath(`/songs/${comment.songId}`);
  revalidatePath('/account');
  redirect(
    `/admin?tab=reports&notice=${
      action === 'dismiss' ? 'report_dismissed' : action === 'delete' ? 'report_deleted' : 'report_muted'
    }`,
  );
}
