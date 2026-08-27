'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { StatusBadge } from '@/components/StatusBadge';

export function ContentItemShell({
  kind,
  title,
  subtitle,
  status,
  badge,
  children,
  dragHandle,
  className,
  ...liProps
}: {
  kind: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  badge?: ReactNode;
  children?: ReactNode;
  dragHandle?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'title' | 'className'>) {
  return (
    <li
      className={`space-y-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 sm:px-5 ${className ?? ''}`}
      {...liProps}
    >
      <div className="flex flex-wrap items-start gap-3">
        {dragHandle ? <div className="mt-1 shrink-0">{dragHandle}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">{kind}</p>
              <p className="mt-1 truncate font-medium text-slate-900">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {badge}
              {status ? <StatusBadge status={status} /> : null}
            </div>
          </div>
        </div>
      </div>
      {children}
    </li>
  );
}
