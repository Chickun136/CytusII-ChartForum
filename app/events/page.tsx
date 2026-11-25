import { Suspense } from 'react';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/time';

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400">
            Activities
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">活动</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            由 Master / Admin 发布的活动会展示在这里。活动类型与参与方式将在后续版本补充。
          </p>

          <Suspense fallback={<EventsSkeleton />}>
            <EventsList />
          </Suspense>
        </section>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归Rayark所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function EventsList() {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { startAt: 'asc' },
    take: 50,
  });

  if (events.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
        <p className="text-sm text-zinc-400">coming s∞n</p>
        <p className="mt-2 text-xs text-zinc-600">目前没有进行中的活动。</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-4">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
              已发布
            </span>
            <h2 className="text-base font-semibold text-zinc-100">{event.title}</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDateTime(event.startAt)} 至 {formatDateTime(event.endAt)}
          </p>
          {event.description && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {event.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function EventsSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-4">
      <div className="h-28 rounded-xl border border-zinc-800 bg-zinc-900/40" />
      <div className="h-28 rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
