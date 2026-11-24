import Link from 'next/link';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { Pagination } from '@/components/pagination';
import { SearchControls } from '@/components/search-controls';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { SongCard } from '@/components/song-card';
import { getCharacters, getSongCount, searchSongs, type SongSort } from '@/lib/songs';

type SearchParams = Promise<{
  q?: string;
  chars?: string;
  min?: string;
  max?: string;
  sort?: string;
  page?: string;
}>;

const MOBILE_UA = /Mobi|Android|iPhone|iPod|Windows Phone/i;

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <header className="mt-8 border-b border-zinc-800 pb-8">
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
  const { q, chars, min, max, sort, page } = await searchParams;
  const query = (q ?? '').trim();

  const [characters, libraryCount] = await Promise.all([getCharacters(), getSongCount()]);
  const selectedCharacters = (chars ?? '')
    .split(',')
    .filter((character) => characters.includes(character));

  const parseLevel = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    if (!value || !Number.isFinite(parsed)) return fallback;
    return Math.min(16, Math.max(1, Math.round(parsed)));
  };
  const minDifficulty = parseLevel(min, 1);
  const maxDifficulty = parseLevel(max, 16);
  const lowerDifficulty = Math.min(minDifficulty, maxDifficulty);
  const upperDifficulty = Math.max(minDifficulty, maxDifficulty);
  const sortValue: SongSort =
    sort === 'difficulty-desc' || sort === 'difficulty-asc' ? sort : 'default';
  const hasFilters =
    selectedCharacters.length > 0 || lowerDifficulty > 1 || upperDifficulty < 16;

  const { songs, total } = await searchSongs(query, {
    characters: selectedCharacters,
    minDifficulty: lowerDifficulty,
    maxDifficulty: upperDifficulty,
    sort: sortValue,
  });

  const userAgent = (await headers()).get('user-agent') ?? '';
  const pageSize = MOBILE_UA.test(userAgent) ? 10 : 40;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number(page);
  const currentPage = Math.min(
    totalPages,
    Math.max(
      1,
      Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1,
    ),
  );
  const startIndex = (currentPage - 1) * pageSize;
  const pageSongs = songs.slice(startIndex, startIndex + pageSize);
  const rangeStart = pageSongs.length > 0 ? startIndex + 1 : 0;
  const rangeEnd = startIndex + pageSongs.length;

  return (
    <section className="mt-8">
      <SearchControls
        key={`${query}|${selectedCharacters.join(',')}|${lowerDifficulty}-${upperDifficulty}|${sortValue}`}
        characters={characters}
        query={query}
        selected={selectedCharacters}
        min={lowerDifficulty}
        max={upperDifficulty}
        sort={sortValue}
      />

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          {query ? (
            <>
              「<span className="text-zinc-100">{query}</span>」找到{' '}
              <span className="font-semibold text-cyan-300">{total}</span> 首
              {total > 0 ? `，正在展示第 ${rangeStart}-${rangeEnd} 首` : ''}
            </>
          ) : hasFilters ? (
            <>
              筛选出 <span className="font-semibold text-cyan-300">{total}</span> 首
              {total > 0 ? `，正在展示第 ${rangeStart}-${rangeEnd} 首` : ''}
            </>
          ) : (
            <>
              曲库共 <span className="font-semibold text-zinc-200">{total}</span> 首
              {total > 0 ? `，正在展示第 ${rangeStart}-${rangeEnd} 首` : ''}
            </>
          )}
        </p>
        {query && (
          <Link href="/" className="text-xs text-zinc-500 transition hover:text-zinc-200">
            清空搜索
          </Link>
        )}
      </div>

      {libraryCount === 0 ? (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
          数据库为空。请先在仓库根目录运行：
          <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">npm run db:import -- --all</code>
        </div>
      ) : total === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          没有找到匹配曲目。可以换一个歌名、拼音首字母、外号，或调整筛选条件。
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {pageSongs.map((song) => (
              <SongCard key={song.id} song={song} query={query} />
            ))}
          </div>
          <Pagination page={currentPage} totalPages={totalPages} />
        </>
      )}
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-[34px] w-full max-w-md rounded-full bg-zinc-900" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 rounded-xl border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
    </div>
  );
}
