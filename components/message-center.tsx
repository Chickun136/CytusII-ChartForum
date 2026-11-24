'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { markNotificationsReadAction } from '@/app/account/actions';
import type { NotificationView } from '@/lib/notifications';

type MessageCenterProps = {
  initialItems: NotificationView[];
  unreadCount: number;
};

type Tab = 'ALL' | 'LIKE' | 'REPLY';

export function MessageCenter({ initialItems, unreadCount }: MessageCenterProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(unreadCount);
  const [tab, setTab] = useState<Tab>('ALL');
  const [, startTransition] = useTransition();

  const likeCount = items.filter((item) => item.type === 'LIKE').length;
  const replyCount = items.filter((item) => item.type === 'REPLY').length;
  const filtered = tab === 'ALL' ? items : items.filter((item) => item.type === tab);

  function toggleOpen() {
    const next = !open;
    setOpen(next);

    if (next && unread > 0) {
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      startTransition(async () => {
        await markNotificationsReadAction();
      });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={unread > 0 ? `消息，${unread} 条未读` : '消息'}
        className="relative flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        消息
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-zinc-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-700 bg-[#0b0d10] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">消息</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-zinc-500 transition hover:text-zinc-200"
            >
              关闭
            </button>
          </div>

          <div className="flex gap-1 border-b border-zinc-800 px-2 py-2 text-xs">
            <TabButton active={tab === 'ALL'} onClick={() => setTab('ALL')}>
              全部 {items.length}
            </TabButton>
            <TabButton active={tab === 'LIKE'} onClick={() => setTab('LIKE')}>
              赞 {likeCount}
            </TabButton>
            <TabButton active={tab === 'REPLY'} onClick={() => setTab('REPLY')}>
              回复 {replyCount}
            </TabButton>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-12 text-center text-xs text-zinc-500">
                {tab === 'LIKE'
                  ? '还没有人赞你的评论'
                  : tab === 'REPLY'
                    ? '还没有人回复你的评论'
                    : '还没有消息'}
              </p>
            ) : (
              filtered.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onNavigate={() => setOpen(false)}
                />
              ))
            )}
          </div>

          <p className="border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600">
            同一评论的多条互动合并展示，仅保留最近一条。
          </p>
        </div>
      )}
    </div>
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

function NotificationRow({
  item,
  onNavigate,
}: {
  item: NotificationView;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/songs/${item.comment.songId}#comment-${item.comment.id}`}
      onClick={onNavigate}
      className="flex gap-3 border-b border-zinc-800/70 px-4 py-3 transition last:border-b-0 hover:bg-zinc-800/50"
    >
      {item.actor.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.actor.avatarUrl}
          alt={`${item.actor.nickname} 的头像`}
          className="h-9 w-9 shrink-0 rounded-full border border-zinc-700 object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300">
          {item.actor.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs leading-5 text-zinc-300">
          <span className="font-semibold text-zinc-100">{item.actor.nickname}</span>
          {item.count > 1 && <span className="text-zinc-400"> 等 {item.count} 人</span>}{' '}
          {item.type === 'LIKE' ? '赞了你的评论' : '回复了你的评论'}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-zinc-500">
          “{item.comment.content}”
        </p>
        <p className="mt-1 text-[11px] text-zinc-600">
          {item.comment.songTitle} · {item.timeLabel}
        </p>
      </div>

      {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
    </Link>
  );
}
