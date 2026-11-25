'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SiteNavProps = {
  showAdmin: boolean;
};

export function SiteNav({ showAdmin }: SiteNavProps) {
  const pathname = usePathname();
  const links = [
    { href: '/', label: '谱面列表' },
    { href: '/account', label: '个人账号' },
    { href: '/events', label: '活动' },
  ];
  if (showAdmin) {
    links.push({ href: '/admin', label: '管理' });
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {links.map((link) => {
        const active =
          link.href === '/'
            ? pathname === '/'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`min-w-20 rounded-full px-3 py-1 text-center font-medium transition ${
              active
                ? 'bg-cyan-500/15 text-cyan-200'
                : 'text-zinc-400 hover:text-cyan-200'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
