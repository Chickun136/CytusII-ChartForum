'use client';

import { useState } from 'react';
import { CommentForm } from './comment-form';

type ReplyBoxProps = {
  songId: string;
  commentId: string;
};

export function ReplyBox({ songId, commentId }: ReplyBoxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-zinc-500 transition hover:text-cyan-200"
      >
        {open ? '取消回复' : '回复'}
      </button>
      {open && (
        <div className="mt-3">
          <CommentForm
            songId={songId}
            parentId={commentId}
            compact
            placeholder="回复这条评论…"
            submitLabel="回复"
          />
        </div>
      )}
    </div>
  );
}
