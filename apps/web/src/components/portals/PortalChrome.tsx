'use client';

import { usePathname } from 'next/navigation';
import { PublicNavbar } from '@/components/portals/public/PublicNavbar';
import { isWorkspacePath } from '@/components/portals/shared/config';

/** Routes workspace portals full-bleed; public portal keeps marketing chrome. */
export function PortalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isWorkspacePath(pathname)) {
    return <div className="h-dvh overflow-hidden bg-ink-950">{children}</div>;
  }

  return (
    <>
      <PublicNavbar />
      <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl px-4 py-6 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:py-10">
        {children}
      </main>
    </>
  );
}
