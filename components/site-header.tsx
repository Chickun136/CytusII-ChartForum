import Link from 'next/link';
import { logoutAction } from '@/app/account/actions';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin, roleLabel, roleStyle } from '@/lib/roles';

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400"
        >
          Cytus II
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-400">
          <Link href="/" className="transition hover:text-cyan-200">
            谱面列表
          </Link>
          <Link href="/account" className="transition hover:text-cyan-200">
            个人账号
          </Link>
          <Link href="/events" className="transition hover:text-cyan-200">
            活动
          </Link>
          {user && canAccessAdmin(user.role) && (
            <Link href="/admin" className="transition hover:text-cyan-200">
              管理
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {user ? (
          <>
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-full border border-zinc-800 px-2 py-1 text-zinc-300 transition hover:border-cyan-500/60"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] text-zinc-300">
                  {user.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
                </span>
              )}
              <span className="max-w-[10rem] truncate">{user.nickname}</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${roleStyle(user.role)}`}
              >
                {roleLabel(user.role)}
              </span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-zinc-800 px-2.5 py-1.5 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              >
                退出
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/account"
            className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20"
          >
            登录 / 注册
          </Link>
        )}
      </div>
    </div>
  );
}

export function SiteHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-4">
      <div className="h-5 w-56 animate-pulse rounded bg-zinc-900" />
      <div className="h-7 w-24 animate-pulse rounded-full bg-zinc-900" />
    </div>
  );
}
