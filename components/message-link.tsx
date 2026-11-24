import Link from 'next/link';

type MessageLinkProps = {
  active: boolean;
  unreadCount: number;
};

export function MessageLink({ active, unreadCount }: MessageLinkProps) {
  return (
    <Link
      href={active ? '/account' : '/account?view=messages'}
      aria-current={active ? 'page' : undefined}
      aria-label={unreadCount > 0 ? `消息，${unreadCount} 条未读` : '消息'}
      className={`relative flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/15 font-medium text-cyan-200'
          : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
      消息
      {unreadCount > 0 && !active && (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-zinc-900" />
      )}
    </Link>
  );
}
