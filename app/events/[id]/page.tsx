import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { submitEventTaskAction } from '@/app/events/[id]/task-actions';
import { EventCommentForm } from '@/components/event-comment-form';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime, hasEventEnded } from '@/lib/time';

type EventParams = Promise<{ id: string }>;

const STATUS_META: Record<string, { label: string; className: string }> = {
  NONE: { label: '参与中', className: 'bg-zinc-800 text-zinc-300' },
  PENDING: { label: '待审批', className: 'bg-amber-500/15 text-amber-200' },
  APPROVED: { label: '已通过 · +1 Capso', className: 'bg-emerald-500/15 text-emerald-200' },
  REJECTED: { label: '未通过', className: 'bg-rose-500/15 text-rose-200' },
};

export default function EventDetailPage({ params }: { params: EventParams }) {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <Suspense fallback={<EventSkeleton />}>
          <EventContent params={params} />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归Rayark所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function EventContent({ params }: { params: EventParams }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { nickname: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, nickname: true, avatarUrl: true, role: true } },
          reviewedBy: { select: { nickname: true } },
        },
      },
    },
  });

  if (!event || event.status !== 'PUBLISHED') notFound();

  const ended = hasEventEnded(event.endAt);
  const canParticipate = Boolean(user) && !ended;

  return (
    <>
      <section className="mt-8">
        <Link href="/events" className="text-xs text-zinc-500 transition hover:text-cyan-200">
          ← 返回活动列表
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
            已发布
          </span>
          {ended && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              已结束
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {formatDateTime(event.startAt)} 至 {formatDateTime(event.endAt)} · 发布者{' '}
          {event.createdBy.nickname}
        </p>
        {event.description && (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4 text-sm leading-6 text-zinc-300">
            {event.description}
          </p>
        )}

        <div className="mt-4 rounded-xl border-[3px] border-cyan-500/20 bg-cyan-500/5 p-4 text-xs leading-6 text-cyan-100/80">
          参与方式：在下方评论区晒出你的任务成果（必须带图），然后点击自己评论上的「提交完成」。
          管理员审批通过后，账号将获得 1 Capso。
        </div>
      </section>

      <section id="task-comments" className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">任务提交</h2>
        <p className="mt-1 text-xs text-zinc-500">
          共 {event.comments.length} 条提交 · 每人每个活动仅可获得一次奖励
        </p>

        <div className="mt-4">
          {canParticipate ? (
            <EventCommentForm eventId={event.id} />
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-400">
              {ended ? (
                '活动已结束，暂时无法提交。'
              ) : (
                <Link href="/account" className="text-cyan-300 transition hover:text-cyan-200">
                  登录
                </Link>
              )}
              {!ended && ' 后即可参与活动。'}
            </p>
          )}
        </div>

        {event.comments.length === 0 ? (
          <p className="mt-6 rounded-xl border-[3px] border-dashed border-zinc-800 py-14 text-center text-sm text-zinc-500">
            还没有提交，来抢第一个 Capso 吧。
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {event.comments.map((comment) => {
              const meta = STATUS_META[comment.status] ?? STATUS_META.NONE;
              const canSubmit =
                Boolean(user) &&
                comment.userId === user!.id &&
                canParticipate &&
                Boolean(comment.imageUrl) &&
                (comment.status === 'NONE' || comment.status === 'REJECTED');

              return (
                <li
                  key={comment.id}
                  className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {comment.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={comment.user.avatarUrl}
                        alt={`${comment.user.nickname} 的头像`}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                        {comment.user.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
                      </span>
                    )}
                    <span className="text-sm font-medium text-zinc-200">
                      {comment.user.nickname}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {formatDateTime(comment.createdAt)}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {comment.content && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                      {comment.content}
                    </p>
                  )}

                  {comment.imageUrl && (
                    <a
                      href={comment.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="查看大图"
                      className="mt-2 block w-fit"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={comment.imageUrl}
                        alt="任务成果截图"
                        loading="lazy"
                        className="max-h-64 w-auto max-w-full rounded-lg border-[3px] border-zinc-800 object-contain transition-colors hover:border-cyan-500/60"
                      />
                    </a>
                  )}

                  {comment.status === 'REJECTED' && comment.reviewNote && (
                    <p className="mt-2 text-xs text-rose-300/80">
                      驳回说明：{comment.reviewNote}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {canSubmit && (
                      <form action={submitEventTaskAction}>
                        <input type="hidden" name="commentId" value={comment.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
                        >
                          提交完成
                        </button>
                      </form>
                    )}
                    {comment.userId === user?.id && !ended && !comment.imageUrl && (
                      <span className="text-xs text-amber-300/80">需附上成果截图才可提交完成</span>
                    )}
                    {comment.status === 'APPROVED' && comment.reviewedBy && (
                      <span className="text-xs text-zinc-600">
                        审批人 {comment.reviewedBy.nickname}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function EventSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-4">
      <div className="h-40 rounded-xl border-[3px] border-zinc-800 bg-zinc-900/40" />
      <div className="h-64 rounded-xl border-[3px] border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
