import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { setRoleAction } from '@/app/account/actions';
import { createEventAction, setEventStatusAction, updateEventAction } from '@/app/admin/event-actions';
import { handleReportAction } from '@/app/admin/report-actions';
import { reviewEventTaskAction } from '@/app/events/[id]/task-actions';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';
import { getCurrentUser } from '@/lib/auth';
import { getReportQueue } from '@/lib/moderation';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin, isMaster, roleLabel, roleStyle } from '@/lib/roles';
import { formatDateTime, toDateTimeLocalValue } from '@/lib/time';

type AdminSearchParams = Promise<{
  tab?: string;
  role?: string;
  error?: string;
  notice?: string;
}>;

const NOTICES: Record<string, string> = {
  created: '活动已创建。',
  updated: '活动已更新。',
  published: '活动已发布。',
  withdrawn: '活动已撤回。',
  draft: '活动已转为草稿。',
  approved: '任务已通过，已为该玩家发放 1 Capso。',
  rejected: '任务已驳回。',
  report_dismissed: '已判定为不违规，举报已关闭。',
  report_deleted: '评论已删除，举报已处理。',
  report_muted: '评论已删除并禁言，举报已处理。',
};

const ERRORS: Record<string, string> = {
  title: '请填写活动标题（不超过 80 字）。',
  description: '活动说明不能超过 2000 字。',
  dates: '请填写开始与结束时间。',
  range: '结束时间必须晚于开始时间。',
  missing: '活动不存在或已被删除。',
  report_missing: '举报对应的评论不存在或已被删除。',
  report_forbidden: '你没有权限处理该举报（Admin 只能处理 Player 的评论）。',
  report_action: '处理方式无效，请重新选择。',
  report_mute: '禁言天数无效，请选择 1 天、3 天或 1 周。',
  report_handled: '该举报已被处理，请刷新后查看最新队列。',
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  WITHDRAWN: '已撤回',
};

export default function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  return (
    <main className="min-h-screen bg-[#050608] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <Suspense fallback={<AdminSkeleton />}>
          <AdminContent searchParams={searchParams} />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Cytus II 曲目与谱面版权归雷亚（Rayark）所有，本站仅用于课程学习与演示。
        </footer>
      </div>
    </main>
  );
}

async function AdminContent({ searchParams }: { searchParams: AdminSearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/account');
  if (!canAccessAdmin(user.role)) redirect('/account');

  const params = await searchParams;
  const tab =
    params.tab === 'events' || params.tab === 'users' || params.tab === 'tasks'
      ? params.tab
      : 'reports';
  const master = isMaster(user.role);
  const notice = params.notice ? NOTICES[params.notice] : null;
  const error = params.error ? ERRORS[params.error] : null;
  const pendingTasks = await prisma.eventComment.count({ where: { status: 'PENDING' } });

  return (
    <section className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {master
          ? 'Master 可处理全部举报、分配管理员，并管理活动。'
          : 'Admin 可处理 Player 的举报、管理活动与查看玩家列表。'}
      </p>

      <nav className="mt-5 flex flex-wrap gap-1 border-b border-zinc-800 pb-2 text-sm">
        <TabLink href="/admin?tab=events" active={tab === 'events'}>
          活动
        </TabLink>
        <TabLink href="/admin?tab=reports" active={tab === 'reports'}>
          举报队列
        </TabLink>
        <TabLink href="/admin?tab=tasks" active={tab === 'tasks'}>
          任务审批{pendingTasks > 0 ? ` (${pendingTasks})` : ''}
        </TabLink>
        <TabLink href="/admin?tab=users" active={tab === 'users'}>
          用户
        </TabLink>
      </nav>

      {notice && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {tab === 'events' && <EventsTab />}
      {tab === 'reports' && <ReportsTab actor={user} />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'users' && <UsersTab actor={user} roleParam={params.role} />}
    </section>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3 py-1 transition ${
        active
          ? 'bg-cyan-500/15 font-medium text-cyan-200'
          : 'text-zinc-400 hover:text-cyan-200'
      }`}
    >
      {children}
    </Link>
  );
}

async function EventsTab() {
  const events = await prisma.event.findMany({
    orderBy: { startAt: 'desc' },
    take: 50,
    include: { createdBy: { select: { nickname: true } } },
  });

  return (
    <div className="mt-5 space-y-6">
      <section className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-200">新建活动</h2>
        <form action={createEventAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400 sm:col-span-2">
            标题
            <input
              name="title"
              required
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="text-xs text-zinc-400 sm:col-span-2">
            说明
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="text-xs text-zinc-400">
            开始时间
            <input
              type="datetime-local"
              name="startAt"
              required
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="text-xs text-zinc-400">
            结束时间
            <input
              type="datetime-local"
              name="endAt"
              required
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-2">
            <input type="checkbox" name="publish" className="h-4 w-4 accent-cyan-500" />
            创建后立即发布
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400"
            >
              创建活动
            </button>
          </div>
        </form>
      </section>

      {events.length === 0 ? (
        <p className="rounded-xl border-[3px] border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
          还没有活动
        </p>
      ) : (
        events.map((event) => (
          <article key={event.id} className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  event.status === 'PUBLISHED'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : event.status === 'WITHDRAWN'
                      ? 'bg-zinc-800 text-zinc-400'
                      : 'bg-amber-500/15 text-amber-200'
                }`}
              >
                {EVENT_STATUS_LABELS[event.status] ?? event.status}
              </span>
              <h3 className="text-sm font-semibold text-zinc-100">{event.title}</h3>
              <span className="text-xs text-zinc-600">创建者 {event.createdBy.nickname}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {formatDateTime(event.startAt)} 至 {formatDateTime(event.endAt)}
            </p>
            {event.description && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-400">
                {event.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={setEventStatusAction}>
                <input type="hidden" name="id" value={event.id} />
                <input
                  type="hidden"
                  name="status"
                  value={event.status === 'PUBLISHED' ? 'WITHDRAWN' : 'PUBLISHED'}
                />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
                >
                  {event.status === 'PUBLISHED' ? '撤回' : '发布'}
                </button>
              </form>
            </div>

            <details className="mt-3 border-t border-zinc-800 pt-3">
              <summary className="cursor-pointer text-xs text-zinc-500 transition hover:text-cyan-200">
                编辑活动
              </summary>
              <form action={updateEventAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={event.id} />
                <label className="text-xs text-zinc-400 sm:col-span-2">
                  标题
                  <input
                    name="title"
                    defaultValue={event.title}
                    required
                    maxLength={80}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
                  />
                </label>
                <label className="text-xs text-zinc-400 sm:col-span-2">
                  说明
                  <textarea
                    name="description"
                    defaultValue={event.description}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  开始时间
                  <input
                    type="datetime-local"
                    name="startAt"
                    defaultValue={toDateTimeLocalValue(event.startAt)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  结束时间
                  <input
                    type="datetime-local"
                    name="endAt"
                    defaultValue={toDateTimeLocalValue(event.endAt)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400"
                  >
                    保存修改
                  </button>
                </div>
              </form>
            </details>
          </article>
        ))
      )}
    </div>
  );
}

async function TasksTab() {
  const tasks = await prisma.eventComment.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    take: 100,
    include: {
      user: { select: { nickname: true, role: true, capso: true } },
      event: { select: { id: true, title: true } },
    },
  });

  if (tasks.length === 0) {
    return (
      <p className="mt-8 rounded-xl border-[3px] border-dashed border-zinc-800 py-14 text-center text-sm text-zinc-500">
        暂无待审批的任务提交
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="text-xs text-zinc-500">
        审批通过后，提交者账号将自动 +1 Capso；每个活动每人仅可获得一次奖励。
      </p>
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-200">
              待审批
            </span>
            <Link
              href={`/events/${task.event.id}`}
              className="text-zinc-400 transition hover:text-cyan-200"
            >
              {task.event.title}
            </Link>
            <span className="text-zinc-600">
              提交人 {task.user.nickname}（{roleLabel(task.user.role)} · 当前 {task.user.capso}{' '}
              Capso）
            </span>
            {task.submittedAt && (
              <span className="text-zinc-600">提交于 {formatDateTime(task.submittedAt)}</span>
            )}
          </div>

          {task.content && (
            <p className="mt-2 break-words text-sm leading-6 text-zinc-200">“{task.content}”</p>
          )}

          {task.imageUrl && (
            <a
              href={task.imageUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="查看大图"
              className="mt-2 block w-fit"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task.imageUrl}
                alt="任务成果截图"
                loading="lazy"
                className="max-h-56 w-auto max-w-full rounded-lg border-[3px] border-zinc-800 object-contain"
              />
            </a>
          )}

          <form
            action={reviewEventTaskAction}
            className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-3"
          >
            <input type="hidden" name="commentId" value={task.id} />
            <label className="min-w-[14rem] flex-1 text-[11px] text-zinc-500">
              审批说明（可选）
              <input
                name="reviewNote"
                maxLength={200}
                placeholder="例如：截图与任务要求不符"
                className="mt-1 block w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/60"
              />
            </label>
            <button
              type="submit"
              name="decision"
              value="approve"
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              通过并 +1 Capso
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
            >
              驳回
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}

async function ReportsTab({ actor }: { actor: { id: string; role: string } }) {
  const groups = await getReportQueue(actor);

  if (groups.length === 0) {
    return (
      <p className="mt-8 rounded-xl border-[3px] border-dashed border-zinc-800 py-14 text-center text-sm text-zinc-500">
        暂无待处理举报
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {groups.map((group) => (
        <article key={group.commentId} className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-200">
              待处理 {group.pendingCount}
            </span>
            <Link
              href={`/songs/${group.songId}#comment-${group.commentId}`}
              className="text-zinc-400 transition hover:text-cyan-200"
            >
              坐标:{group.songTitle}
            </Link>
            <span className="text-zinc-600">最早举报 {group.earliestLabel}</span>
          </div>

          <p className="mt-2 break-words text-sm leading-6 text-zinc-200">
            “{group.commentContent}”
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            作者：{group.author.nickname}（{roleLabel(group.author.role)}）
          </p>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-zinc-500 transition hover:text-cyan-200">
              查看 {group.reports.length} 条举报说明
            </summary>
            <ul className="mt-2 space-y-2 border-l border-zinc-800 pl-3">
              {group.reports.map((report) => (
                <li key={report.id} className="text-xs leading-5 text-zinc-400">
                  <span className="font-medium text-zinc-300">{report.reporterNickname}</span>
                  <span className="text-zinc-600"> · {report.createdAtLabel}</span>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{report.content}</p>
                </li>
              ))}
            </ul>
          </details>

          {group.canHandle ? (
            <form
              action={handleReportAction}
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-3"
            >
              <input type="hidden" name="commentId" value={group.commentId} />
              <label className="text-[11px] text-zinc-500">
                处理方式
                <select
                  name="action"
                  className="mt-1 block rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/60"
                >
                  <option value="dismiss">忽略（不违规）</option>
                  <option value="delete">删除评论</option>
                  <option value="delete_mute">删除并禁言</option>
                </select>
              </label>
              <label className="text-[11px] text-zinc-500">
                禁言天数（仅“删除并禁言”时生效）
                <select
                  name="muteDays"
                  className="mt-1 block rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/60"
                >
                  <option value="1">1 天</option>
                  <option value="3">3 天</option>
                  <option value="7">1 周</option>
                </select>
              </label>
              <label className="min-w-[10rem] flex-1 text-[11px] text-zinc-500">
                处理说明（可选）
                <input
                  name="resolution"
                  maxLength={200}
                  className="mt-1 block w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/60"
                />
              </label>
              <button
                type="submit"
                className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-rose-400"
              >
                提交处理
              </button>
            </form>
          ) : (
            <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-amber-300/80">
              该评论作者为管理员，只有 Master 可以处理。
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

async function UsersTab({
  actor,
  roleParam,
}: {
  actor: { id: string; role: string };
  roleParam?: string;
}) {
  const master = isMaster(actor.role);
  const roleFilter = master && roleParam === 'ADMIN' ? 'ADMIN' : 'PLAYER';

  const users = await prisma.user.findMany({
    where: { role: master ? roleFilter : 'PLAYER' },
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

  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="mt-5">
      {master ? (
        <div className="flex gap-1 text-xs">
          <Link
            href="/admin?tab=users&role=PLAYER"
            className={`rounded-full px-3 py-1 transition ${
              roleFilter === 'PLAYER'
                ? 'bg-cyan-500/15 font-medium text-cyan-200'
                : 'text-zinc-500 hover:text-cyan-200'
            }`}
          >
            Player 列表
          </Link>
          <Link
            href="/admin?tab=users&role=ADMIN"
            className={`rounded-full px-3 py-1 transition ${
              roleFilter === 'ADMIN'
                ? 'bg-cyan-500/15 font-medium text-cyan-200'
                : 'text-zinc-500 hover:text-cyan-200'
            }`}
          >
            Admin 列表
          </Link>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Admin 仅可查看 Player 列表。</p>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border-[3px] border-zinc-800">
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
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-xs text-zinc-500">
                  暂无账号
                </td>
              </tr>
            ) : (
              users.map((item) => (
                <tr key={item.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{item.nickname}</p>
                    <p className="text-xs text-zinc-500">{item.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: roleStyle(item.role).bg, color: roleStyle(item.role).fg }}
                    >
                      {roleLabel(item.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-300">{item.capso}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {dateFormat.format(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {master && item.role !== 'MASTER' && item.id !== actor.id ? (
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
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-8 w-40 rounded bg-zinc-900" />
      <div className="mt-6 h-64 rounded-xl border-[3px] border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
