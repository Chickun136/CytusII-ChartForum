import { Suspense } from 'react';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';

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
            活动系统正在开发中。上线后管理员可编辑并发布活动，玩家完成活动可获得 Capso。
          </p>

          <div className="mt-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
            <p className="text-sm text-zinc-400">coming s∞n</p>
            <p className="mt-2 text-xs text-zinc-600">
              Master / Admin 将拥有活动编辑与发布权限。
            </p>
          </div>
        </section>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}
