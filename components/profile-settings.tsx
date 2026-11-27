'use client';

import { useActionState } from 'react';
import { updateAvatarAction, updateNicknameAction } from '@/app/account/actions';

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20';

export function ProfileSettings({ nickname }: { nickname: string }) {
  const [nickState, nickAction, nickPending] = useActionState(updateNicknameAction, null);
  const [avatarState, avatarAction, avatarPending] = useActionState(updateAvatarAction, null);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <form
        action={nickAction}
        className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/40 p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-200">昵称设置</h2>
        <p className="mt-1 text-xs text-zinc-500">2–20 个字符，显示在顶部菜单与评论区。</p>
        <label className="mt-4 block text-xs text-zinc-500" htmlFor="nickname">
          昵称
        </label>
        <input
          id="nickname"
          name="nickname"
          defaultValue={nickname}
          required
          minLength={2}
          maxLength={20}
          className={`mt-1 ${inputClass}`}
        />
        {nickState?.error && <p className="mt-2 text-xs text-rose-300">{nickState.error}</p>}
        {nickState?.success && (
          <p className="mt-2 text-xs text-emerald-300">{nickState.success}</p>
        )}
        <button
          type="submit"
          disabled={nickPending}
          className="mt-4 h-9 rounded-lg bg-cyan-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
        >
          {nickPending ? '保存中…' : '保存昵称'}
        </button>
      </form>

      <form
        action={avatarAction}
        className="rounded-xl border-[3px] border-zinc-800 bg-zinc-900/40 p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-200">头像设置</h2>
        <p className="mt-1 text-xs text-zinc-500">支持 PNG / JPG / WebP，最大 1 MB。</p>
        <input
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp"
          required
          className="mt-4 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200 hover:file:bg-zinc-700"
        />
        {avatarState?.error && (
          <p className="mt-2 text-xs text-rose-300">{avatarState.error}</p>
        )}
        {avatarState?.success && (
          <p className="mt-2 text-xs text-emerald-300">{avatarState.success}</p>
        )}
        <button
          type="submit"
          disabled={avatarPending}
          className="mt-4 h-9 rounded-lg bg-cyan-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
        >
          {avatarPending ? '上传中…' : '上传头像'}
        </button>
      </form>
    </div>
  );
}
