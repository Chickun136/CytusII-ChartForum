'use client';

import { deleteCommentAction } from '@/app/songs/[id]/comment-actions';

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  return (
    <form
      action={deleteCommentAction}
      onSubmit={(event) => {
        if (!window.confirm('确定删除这条评论？')) event.preventDefault();
      }}
    >
      <input type="hidden" name="commentId" value={commentId} />
      <button
        type="submit"
        className="text-xs text-zinc-500 transition hover:text-rose-300"
      >
        删除
      </button>
    </form>
  );
}
