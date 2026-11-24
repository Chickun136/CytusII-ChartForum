import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { setRoleAction } from '@/app/account/actions';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin, isMaster, roleLabel, roleStyle } from '@/lib/roles';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <Suspense fallback={<AdminSkeleton />}>
          <AdminContent />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function AdminContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/account');
  if (!canAccessAdmin(user.role)) redirect('/account');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      nickname: true,
      role: true,
      capso: true,
      createdAt: true,
    },
  });
  const master = isMaster(user.role);
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <section className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {master
          ? 'Master 可为其他账号分配 Admin 或 Player 权限。'
          : 'Admin 可查看账号列表；只有 Master 可以分配管理员。'}
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-zinc-900/70 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">账号</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">Capso</th>
              <th className="px-4 py-3 font-medium">注册时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-zinc-800">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">{item.nickname}</p>
                  <p className="text-xs text-zinc-500">{item.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${roleStyle(item.role)}`}
                  >
                    {roleLabel(item.role)}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-300">{item.capso}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {dateFormat.format(item.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {master && item.role !== 'MASTER' && item.id !== user.id ? (
                    <form action={setRoleAction}>
                      <input type="hidden" name="userId" value={item.id} />
                      <input
                        type="hidden"
                        name="role"
                        value={item.role === 'ADMIN' ? 'PLAYER' : 'ADMIN'}
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
                      >
                        {item.role === 'ADMIN' ? '降为 Player' : '设为 Admin'}
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-600">
                      {item.role === 'MASTER' ? '内部账号' : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-200">活动管理</h2>
        <p className="mt-2 text-xs leading-6 text-zinc-500">
          活动编辑与发布将在活动模块开发后开放；届时 Master / Admin 可设置活动内容与 Capso 奖励。
        </p>
      </section>
    </section>
  );
}

function AdminSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-8 w-40 rounded bg-zinc-900" />
      <div className="mt-6 h-64 rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
