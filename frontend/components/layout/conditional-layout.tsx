'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const workspacePrefixes = ['/dashboard', '/lectures/new'];
  const isWorkspace = workspacePrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  // Routes that should NOT have header/footer
  const isFullscreen = pathname === '/present' || isWorkspace;

  if (isFullscreen) {
    // No marketing chrome for fullscreen or workspace routes.
    return <>{children}</>;
  }

  // Normal layout with header and footer
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
