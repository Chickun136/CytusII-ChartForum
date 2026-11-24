import Link from 'next/link';
import type { MyReportView } from '@/lib/moderation';

export function ReportSection({ items }: { items: MyReportView[] }) {
  return (
    <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-zinc-100 sm:text-lg">我的举报</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          共 {items.length} 条
        </span>
        <Link
          href="/account"
          className="ml-auto text-xs text-zinc-500 transition hover:text-cyan-200 sm:text-sm"
        >
          返回个人资料
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-zinc-500 sm:text-base">
          还没有提交过举报
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              className="border-b border-zinc-800/70 px-4 py-3 last:border-b-0 sm:px-5 sm:py-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    item.status === 'PENDING'
                      ? 'bg-amber-500/15 text-amber-200'
                      : item.status === 'RESOLVED'
                        ? 'bg-rose-500/15 text-rose-200'
                        : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {item.statusLabel}
                </span>
                <Link
                  href={`/songs/${item.comment.songId}#comment-${item.comment.id}`}
                  className="text-zinc-400 transition hover:text-cyan-200"
                >
                  坐标:{item.comment.songTitle}
                </Link>
                <span className="text-zinc-600">{item.createdAtLabel}</span>
              </div>

              <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
                被举报评论：{item.comment.content}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">
                你的说明：{item.content}
              </p>

              {item.status !== 'PENDING' && (
                <p className="mt-1 text-[11px] leading-5 text-zinc-600 sm:text-xs">
                  {item.handledByNickname ? `处理人：${item.handledByNickname}` : ''}
                  {item.handledAtLabel ? ` · ${item.handledAtLabel}` : ''}
                  {item.resolution ? ` · ${item.resolution}` : ''}
                  {item.muteUntilLabel ? ` · 作者禁言至 ${item.muteUntilLabel}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600 sm:px-5 sm:py-2.5 sm:text-xs">
        只有你能看到自己提交的举报记录与处理结果。
      </p>
    </section>
  );
}
