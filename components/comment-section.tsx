import Link from 'next/link';
import { toggleCommentLikeAction } from '@/app/songs/[id]/comment-actions';
import { CommentForm } from '@/components/comment-form';
import { DeleteCommentButton } from '@/components/delete-comment-button';
import { ReportForm } from '@/components/report-form';
import { ReplyBox } from '@/components/reply-box';
import { getCurrentUser } from '@/lib/auth';
import { getSongComments, type CommentView } from '@/lib/comments';
import { getActiveMute } from '@/lib/moderation';
import { canDeleteComment } from '@/lib/permissions';
import { formatDateTime, formatRelativeTime } from '@/lib/time';

type CommentSectionProps = {
  songId: string;
};

type Viewer = { id: string; role: string };

export async function CommentSection({ songId }: CommentSectionProps) {
  const user = await getCurrentUser();
  const [comments, mute] = await Promise.all([
    getSongComments(songId, user?.id),
    user ? getActiveMute(user.id) : Promise.resolve(null),
  ]);

  const mutedUntil = mute?.muteUntil ? formatDateTime(mute.muteUntil) : null;
  const viewer: Viewer | null = user ? { id: user.id, role: user.role } : null;
  const total = comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);

  return (
    <section className="mt-12">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
        <h2 className="text-base font-semibold text-zinc-100">评论</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{total}</span>
        <span className="ml-auto text-xs text-zinc-300">最新</span>
      </div>

      <div className="mt-5">
        {user ? (
          mutedUntil ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-200">
              您已被限制评论功能，{mutedUntil} 后方可正常发布评论。
            </div>
          ) : (
            <div className="flex gap-3">
              <Avatar author={{ nickname: user.nickname, avatarUrl: user.avatarUrl }} />
              <div className="min-w-0 flex-1">
                <CommentForm songId={songId} />
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
            <p className="text-sm text-zinc-400">登录后可以评论、点赞和回复。</p>
            <Link
              href="/account"
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
            >
              去登录
            </Link>
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-800 py-14 text-center">
          <p className="text-sm text-zinc-400">还没有评论</p>
          <p className="mt-1 text-xs text-zinc-600">来写第一条评论吧。</p>
        </div>
      ) : (
        <div className="mt-4">
          {comments.map((comment) => (
            <article
              key={comment.id}
              id={`comment-${comment.id}`}
              className="border-b border-zinc-800/80 py-5"
            >
              <CommentBody
                comment={comment}
                songId={songId}
                viewer={viewer}
                muted={Boolean(mutedUntil)}
              />
              {comment.replies.length > 0 && (
                <div className="mt-4 ml-12 border-l border-zinc-800 pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} id={`comment-${reply.id}`} className="py-3 first:pt-0 last:pb-0">
                      <CommentBody
                        comment={reply}
                        songId={songId}
                        viewer={viewer}
                        muted={Boolean(mutedUntil)}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CommentBody({
  comment,
  songId,
  viewer,
  muted,
  compact = false,
}: {
  comment: CommentView;
  songId: string;
  viewer: Viewer | null;
  muted: boolean;
  compact?: boolean;
}) {
  const loggedIn = Boolean(viewer);
  const canDelete =
    Boolean(viewer) &&
    !comment.deleted &&
    canDeleteComment(viewer, {
      userId: comment.author.id,
      authorRole: comment.author.role,
    });
  const canReport = Boolean(viewer) && !comment.deleted && viewer?.id !== comment.author.id;

  return (
    <div className="flex gap-3">
      <Avatar author={comment.author} compact={compact} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{comment.author.nickname}</span>
          <span className="text-xs text-zinc-600">{formatRelativeTime(comment.createdAt)}</span>
        </div>

        {comment.deleted ? (
          <p className="mt-1 text-sm italic leading-6 text-zinc-500">
            {comment.deletedBySelf ? '该评论已被删除' : '该评论已被管理员删除'}
          </p>
        ) : (
          <>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {comment.content}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <LikeButton comment={comment} loggedIn={loggedIn} />
              {!compact && !muted && <ReplyBox songId={songId} commentId={comment.id} />}
              {!compact && muted && (
                <span className="text-xs text-amber-300/80">禁言期间暂不能回复</span>
              )}
              {canDelete && <DeleteCommentButton commentId={comment.id} />}
              {canReport && <ReportForm commentId={comment.id} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LikeButton({ comment, loggedIn }: { comment: CommentView; loggedIn: boolean }) {
  const className = `text-xs transition ${
    comment.likedByMe ? 'text-rose-300' : 'text-zinc-500 hover:text-rose-300'
  }`;

  if (!loggedIn) {
    return (
      <Link href="/account" className={className}>
        ♡ {comment.likeCount}
      </Link>
    );
  }

  return (
    <form action={toggleCommentLikeAction}>
      <input type="hidden" name="commentId" value={comment.id} />
      <button
        type="submit"
        className={className}
        aria-label={comment.likedByMe ? '取消点赞' : '点赞'}
      >
        {comment.likedByMe ? '♥' : '♡'} {comment.likeCount}
      </button>
    </form>
  );
}

function Avatar({
  author,
  compact = false,
}: {
  author: Pick<CommentView['author'], 'nickname' | 'avatarUrl'>;
  compact?: boolean;
}) {
  const size = compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  if (author.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatarUrl}
        alt={`${author.nickname} 的头像`}
        className={`${size} shrink-0 rounded-full border border-zinc-700 object-cover`}
      />
    );
  }

  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 font-semibold text-zinc-300`}
    >
      {author.nickname.trim().slice(0, 1).toUpperCase() || 'P'}
    </span>
  );
}
