'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { workspaceBack } from '@/lib/workspace-back';

export function WorkspaceBackAnchor({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-accent"
    >
      ← {label}
    </Link>
  );
}

export function WorkspaceBackLink() {
  const pathname = usePathname();
  const back = workspaceBack(pathname);
  if (!back) {
    return null;
  }

  return <WorkspaceBackAnchor href={back.href} label={back.label} />;
}
