'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_REPORT_LENGTH = 200;

export type ReportActionState = { error?: string; success?: string } | null;

export async function createReportAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/account');

  const commentId = String(formData.get('commentId') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();

  if (!commentId) return { error: '缺少评论信息。' };
  if (!content) return { error: '请填写举报说明。' };
  if (content.length > MAX_REPORT_LENGTH) {
    return { error: `举报说明不能超过 ${MAX_REPORT_LENGTH} 个字符。` };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, songId: true, userId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) return { error: '该评论不存在或已被删除。' };
  if (comment.userId === user.id) return { error: '不能举报自己的评论。' };

  try {
    await prisma.report.create({
      data: { commentId, reporterId: user.id, content },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: '你已经举报过这条评论。' };
    }
    console.error(error);
    return { error: '举报提交失败，请稍后重试。' };
  }

  revalidatePath(`/songs/${comment.songId}`);
  revalidatePath('/admin');
  return { success: '举报已提交，处理结果会通过消息通知你。' };
}
