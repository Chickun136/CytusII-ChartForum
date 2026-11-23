export function CommentSection() {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
        <h2 className="text-base font-semibold text-zinc-100">评论</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">0</span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-zinc-200">最新</span>
          <span className="text-zinc-600">最热</span>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 bg-zinc-800"
          aria-hidden="true"
        />
        <div className="flex-1">
          <textarea
            disabled
            rows={3}
            placeholder="登录后参与评论…"
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-600">评论与账号系统将在 P1 上线。</p>
            <button
              type="button"
              disabled
              className="rounded-lg bg-cyan-500/40 px-4 py-1.5 text-xs font-semibold text-zinc-950/60"
            >
              发布
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-800 py-14 text-center">
        <p className="text-sm text-zinc-400">还没有评论</p>
        <p className="mt-1 text-xs text-zinc-600">
          这里已预留评论区排版：头像 + 昵称 + 时间 + 正文，支持发送图片。
        </p>
      </div>
    </section>
  );
}
