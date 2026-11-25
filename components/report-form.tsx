'use client';

import { useActionState } from 'react';
import {
  createReportAction,
  type ReportActionState,
} from '@/app/songs/[id]/report-actions';

export function ReportForm({ commentId }: { commentId: string }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    createReportAction,
    null,
  );

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs text-zinc-500 transition hover:text-rose-300">
        举报
      </summary>
      <form
        action={formAction}
        className="mt-2 w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950/80 p-3"
      >
        <input type="hidden" name="commentId" value={commentId} />
        <textarea
          name="content"
          required
          maxLength={200}
          rows={3}
          placeholder="请填写举报说明（必填）"
          className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10"
        />
        {state?.error && <p className="mt-1.5 text-xs text-rose-300">{state.error}</p>}
        {state?.success && <p className="mt-1.5 text-xs text-emerald-300">{state.success}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-600">最多 200 字</span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? '提交中…' : '提交举报'}
          </button>
        </div>
      </form>
    </details>
  );
}
