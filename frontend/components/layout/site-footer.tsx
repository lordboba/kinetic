import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Lecture Gen — Adaptive lectures for every learner.
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            We pair an AI lead instructor with a supporting TA to scaffold
            comprehension, practice, and engagement for any topic.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-500 sm:text-right">
          <Link href="/lectures" className="hover:text-slate-900">
            Explore lecture templates
          </Link>
          <Link href="/login" className="hover:text-slate-900">
            Manage your learning profile
          </Link>
          <span className="text-xs text-slate-400">
            Built with Next.js, Fastify APIs, and LiveKit media infrastructure.
          </span>
        </div>
      </div>
    </footer>
  );
}
