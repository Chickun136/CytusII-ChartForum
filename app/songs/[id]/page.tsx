import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChartViewer, type ChartSummary } from '@/components/chart-viewer';
import { CommentSection } from '@/components/comment-section';
import { getSong } from '@/lib/songs';

type SongParams = Promise<{ id: string }>;

export default function SongPage({ params }: { params: SongParams }) {
  return (
    <Suspense fallback={<SongSkeleton />}>
      <SongContent params={params} />
    </Suspense>
  );
}

async function SongContent({ params }: { params: SongParams }) {
  const { id } = await params;
  const song = await getSong(id);

  if (!song) notFound();

  const charts: ChartSummary[] = song.charts.map((chart) => ({
    id: chart.id,
    difficultyName: chart.difficultyName,
    difficultyLevel: chart.difficultyLevel,
    pageCount: chart.pageCount,
    noteCount: chart.noteCount,
    jsonFile: chart.jsonFile,
  }));

  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Link href="/" className="text-xs text-zinc-500 transition hover:text-cyan-200">
          ← 返回搜索
        </Link>

        <header className="mt-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{song.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">{song.artist}</p>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {charts.length} 个难度
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
            {song.character && (
              <span className="rounded-full border border-zinc-800 px-2.5 py-1">
                角色：{song.character}
              </span>
            )}
            {song.bpm && (
              <span className="rounded-full border border-zinc-800 px-2.5 py-1">
                BPM {song.bpm}
              </span>
            )}
            {song.aliases.length > 0 && (
              <span className="rounded-full border border-zinc-800 px-2.5 py-1">
                别名：{song.aliases.map((alias) => alias.alias).join('、')}
              </span>
            )}
          </div>
        </header>

        <ChartViewer charts={charts} title={song.title} artist={song.artist} />

        <CommentSection />

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

function SongSkeleton() {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8">
        <div className="h-4 w-20 rounded bg-zinc-900" />
        <div className="mt-8 h-10 w-2/3 rounded bg-zinc-900" />
        <div className="mt-4 h-4 w-40 rounded bg-zinc-900" />
        <div className="mt-8 h-12 rounded-xl bg-zinc-900" />
        <div className="mt-4 aspect-[512/420] rounded-xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </main>
  );
}
