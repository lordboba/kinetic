"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const navItems = [
  { href: "/#mission", label: "Mission" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/lectures", label: "Lectures" },
  { href: "/#sponsor-integrations", label: "Integrations" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const onSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold !text-primary">
            Blazz
          </Link>

          {pathname.startsWith("/dashboard") && user && (
            <Link
              href="/dashboard"
              className="hidden items-center rounded-full bg-secondary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary-600 sm:inline-flex"
            >
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-6">
          {!pathname.startsWith("/dashboard") && (
            <nav className="hidden items-center gap-6 text-sm font-medium text-primary sm:flex">
              {navItems.map((item) => {
                const isAnchor = item.href.includes("#");
                const isActive = isAnchor
                  ? pathname === "/" && item.href.startsWith("/#")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition-colors hover:text-primary-700 ${
                      isActive ? "text-primary-700 font-semibold" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {user && !pathname.startsWith("/dashboard") && (
            <>
              <div className="hidden h-6 w-px bg-slate-300 sm:block" />
              <Link
                href="/dashboard"
                className="hidden items-center rounded-full bg-secondary-50 px-4 py-2 text-sm font-semibold text-secondary-700 transition hover:bg-secondary-100 sm:inline-flex"
              >
                Dashboard
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          ) : user ? (
            <>
              <span className="hidden text-sm text-primary-500 sm:inline">
                {user.email ?? user.displayName ?? "Signed in"}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:bg-foreground/90"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
