import Link from 'next/link';
import { Suspense } from 'react';
import { logoutAction } from './actions';
import { AuthForms } from '@/components/auth-forms';
import { ProfileSettings } from '@/components/profile-settings';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin, roleLabel, roleStyle } from '@/lib/roles';

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <Suspense fallback={<AccountSkeleton />}>
          <AccountContent />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function AccountContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="mt-8">
        <h1 className="text-2xl font-bold tracking-tight">个人账号</h1>
        <p className="mt-2 text-sm text-zinc-400">
          登录或注册以保存昵称、头像与 Capso，并在活动上线后领取奖励。
        </p>
        <AuthForms />
      </section>
    );
  }

  const created = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(user.createdAt);

  const roleNote =
    user.role === 'MASTER'
      ? '内部账号：可分配管理员，并管理后续活动。'
      : user.role === 'ADMIN'
        ? '管理员：可进入管理后台，活动编辑与发布待活动模块上线。'
        : '玩家：可查看谱面、参与活动并获取 Capso。';

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={`${user.nickname} 的头像`}
            className="h-20 w-20 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-2xl font-semibold text-zinc-300">
            {user.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{user.nickname}</h1>
          <p className="mt-1 truncate text-sm text-zinc-400">{user.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full border px-2 py-0.5 ${roleStyle(user.role)}`}>
              {roleLabel(user.role)}
            </span>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300">
              Capso {user.capso}
            </span>
            <span className="text-zinc-600">注册于 {created}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAccessAdmin(user.role) && (
            <Link
              href="/admin"
              className="h-9 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 text-xs font-medium leading-9 text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20"
            >
              管理后台
            </Link>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="h-9 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              退出登录
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-xs leading-6 text-zinc-500">
        <p>{roleNote}</p>
        <p>Capso 默认为 0；活动系统上线后，完成活动会按活动规则增加。</p>
      </div>

      <ProfileSettings nickname={user.nickname} />
    </section>
  );
}

function AccountSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-32 rounded-xl border border-zinc-800 bg-zinc-900/40" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="h-44 rounded-xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-44 rounded-xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </div>
  );
}
