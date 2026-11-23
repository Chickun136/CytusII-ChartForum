import Link from 'next/link';
import { Suspense } from 'react';
import { SongCard } from '@/components/song-card';
import { getSongCount, searchSongs } from '@/lib/songs';

type SearchParams = Promise<{ q?: string }>;

const EXAMPLES = ['AIAIAI', 'bwfm', '绊爱', 'Kizuna'];

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <header className="border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400">
            Cytus II Chart Forum
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            找到你的下一张谱面
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            支持歌名、艺术家、角色、拼音全拼、拼音首字母与外号搜索。例：
            <span className="mx-1 text-zinc-200">bwfm-&gt;Bullet Waiting for Me</span>
          </p>
        </header>

        <Suspense fallback={<SearchSkeleton />}>
          <SearchContent searchParams={searchParams} />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function SearchContent({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const [songs, total] = await Promise.all([searchSongs(query), getSongCount()]);

  return (
    <section className="mt-8">
      <form key={query} action="/" method="get" className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="search-input" className="sr-only">
          搜索曲目
        </label>
        <input
          id="search-input"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="输入歌名、拼音、首字母或外号…"
          autoComplete="off"
          className="h-12 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
        >
          搜索
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>试试：</span>
        {EXAMPLES.map((example) => (
          <Link
            key={example}
            href={`/?q=${encodeURIComponent(example)}`}
            className="rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            {example}
          </Link>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          {query ? (
            <>
              「<span className="text-zinc-100">{query}</span>」找到{' '}
              <span className="font-semibold text-cyan-300">{songs.length}</span> 首
            </>
          ) : (
            <>
              曲库共 <span className="font-semibold text-zinc-200">{total}</span> 首，先看看这些
            </>
          )}
        </p>
        {query && (
          <Link href="/" className="text-xs text-zinc-500 transition hover:text-zinc-200">
            清空搜索
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
          数据库为空。请先在仓库根目录运行：
          <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">npm run db:import -- --all</code>
        </div>
      ) : songs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          没有找到匹配曲目。可以换一个歌名、拼音首字母或外号试试。
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} query={query} />
          ))}
        </div>
      )}
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-12 rounded-xl bg-zinc-900" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 rounded-xl border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
    </div>
  );
}
