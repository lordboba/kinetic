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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">
            Lecture Gen
          </Link>

          {pathname.startsWith("/dashboard") && user && (
            <Link
              href="/dashboard"
              className="hidden items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 sm:inline-flex"
            >
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-6">
          {!pathname.startsWith("/dashboard") && (
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
              {navItems.map((item) => {
                const isAnchor = item.href.includes("#");
                const isActive = isAnchor
                  ? pathname === "/" && item.href.startsWith("/#")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition-colors hover:text-slate-900 ${
                      isActive ? "text-slate-900" : ""
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
                className="hidden items-center rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200 sm:inline-flex"
              >
                Dashboard
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="h-9 w-9 animate-spin rounded-full border border-slate-300 border-t-transparent" />
          ) : user ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user.email ?? user.displayName ?? "Signed in"}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
