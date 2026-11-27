'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { markNotificationsReadAction } from '@/app/account/actions';
import type { NotificationView } from '@/lib/notifications';

type Tab = 'ALL' | 'LIKE' | 'REPLY' | 'HANDLED';

type MessageSectionProps = {
  initialItems: NotificationView[];
};

const TYPE_TEXT: Record<NotificationView['type'], string> = {
  LIKE: '赞了你的评论',
  REPLY: '回复了你的评论',
  REPORT_RESULT: '处理了你举报的评论',
  MODERATION: '删除了你的评论',
};

export function MessageSection({ initialItems }: MessageSectionProps) {
  const [tab, setTab] = useState<Tab>('ALL');
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    if (!initialItems.some((item) => !item.isRead)) return;

    marked.current = true;
    void markNotificationsReadAction();
  }, [initialItems]);

  const likeCount = initialItems.filter((item) => item.type === 'LIKE').length;
  const replyCount = initialItems.filter((item) => item.type === 'REPLY').length;
  const handledCount = initialItems.filter(
    (item) => item.type === 'REPORT_RESULT' || item.type === 'MODERATION',
  ).length;

  const filtered =
    tab === 'ALL'
      ? initialItems
      : tab === 'HANDLED'
        ? initialItems.filter(
            (item) => item.type === 'REPORT_RESULT' || item.type === 'MODERATION',
          )
        : initialItems.filter((item) => item.type === tab);

  return (
    <section className="mt-4 rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-zinc-100 sm:text-lg">消息</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          共 {initialItems.length} 条
        </span>
        <Link
          href="/account"
          className="ml-auto text-xs text-zinc-500 transition hover:text-cyan-200 sm:text-sm"
        >
          返回个人资料
        </Link>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-zinc-800 px-2 py-2 text-xs sm:px-3 sm:text-sm">
        <TabButton active={tab === 'ALL'} onClick={() => setTab('ALL')}>
          全部 {initialItems.length}
        </TabButton>
        <TabButton active={tab === 'LIKE'} onClick={() => setTab('LIKE')}>
          赞 {likeCount}
        </TabButton>
        <TabButton active={tab === 'REPLY'} onClick={() => setTab('REPLY')}>
          回复 {replyCount}
        </TabButton>
        <TabButton active={tab === 'HANDLED'} onClick={() => setTab('HANDLED')}>
          处理 {handledCount}
        </TabButton>
      </div>

      <div>
        {filtered.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-zinc-500 sm:text-base">
            {tab === 'LIKE'
              ? '还没有人赞你的评论'
              : tab === 'REPLY'
                ? '还没有人回复你的评论'
                : tab === 'HANDLED'
                  ? '还没有举报或处理消息'
                  : '还没有消息'}
          </p>
        ) : (
          filtered.map((item) => {
            const href =
              item.type === 'REPORT_RESULT'
                ? '/account?view=reports'
                : `/songs/${item.comment.songId}#comment-${item.comment.id}`;
            const isHandled = item.type === 'REPORT_RESULT' || item.type === 'MODERATION';

            return (
              <Link
                key={item.id}
                href={href}
                className="flex gap-3 border-b border-zinc-800/70 px-4 py-3 transition last:border-b-0 hover:bg-zinc-800/50 sm:gap-4 sm:px-5 sm:py-4"
              >
                {item.actor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.actor.avatarUrl}
                    alt={`${item.actor.nickname} 的头像`}
                    className="h-9 w-9 shrink-0 rounded-full border border-zinc-700 object-cover sm:h-10 sm:w-10"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300 sm:h-10 sm:w-10 sm:text-sm">
                    {item.actor.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-6">
                    {isHandled ? '管理员 ' : ''}
                    <span className="font-semibold text-zinc-100">{item.actor.nickname}</span>
                    {item.count > 1 && !isHandled && (
                      <span className="text-zinc-400"> 等 {item.count} 人</span>
                    )}{' '}
                    {TYPE_TEXT[item.type]}
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">
                    “{item.comment.content}”
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">
                    坐标:{item.comment.songTitle} · {item.timeLabel}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <p className="border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600 sm:px-5 sm:py-2.5 sm:text-xs">
        同一评论的多条互动合并展示，仅保留最近一条。
      </p>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 transition ${
        active ? 'bg-cyan-500/15 text-cyan-200' : 'text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}
