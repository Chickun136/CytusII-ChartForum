'use client';

import { useActionState } from 'react';
import {
  createCommentAction,
  type CommentActionState,
} from '@/app/songs/[id]/comment-actions';

type CommentFormProps = {
  songId: string;
  parentId?: string;
  compact?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

export function CommentForm({
  songId,
  parentId,
  compact = false,
  placeholder = '说点什么…',
  submitLabel = '发布',
}: CommentFormProps) {
  const [state, formAction, pending] = useActionState<CommentActionState, FormData>(
    createCommentAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="songId" value={songId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="content"
        required
        maxLength={500}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10"
      />
      {state?.error && <p className="mt-1.5 text-xs text-rose-300">{state.error}</p>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">最多 500 字</p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? '发送中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
