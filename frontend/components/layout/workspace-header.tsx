"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const workspaceLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const visibleWorkspaceLinks = workspaceLinks.filter((link) => {
    const isActive =
      pathname === link.href || pathname.startsWith(`${link.href}/`);
    return !(link.href === "/lectures/new" && isActive);
  });

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
          Lecture Gen Studio
        </Link>

        <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600">
          {visibleWorkspaceLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {user?.email ?? user?.displayName ?? "Signed in"}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
