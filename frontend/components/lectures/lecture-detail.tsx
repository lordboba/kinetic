import Link from "next/link";
import type { LectureAsset } from "@/lib/schemas/lecture";
import { LectureStatusTimeline } from "@/components/lectures/lecture-status-timeline";

export function LectureDetail({ lecture }: { lecture: LectureAsset }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Lecture blueprint
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">
            {lecture.title}
          </h1>
          <p className="text-lg text-slate-600">{lecture.summary}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Instructor note
          </h2>
          <p className="mt-3 text-sm text-slate-600">{lecture.instructorNote}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Practice prompts
          </h2>
          <ul className="mt-4 space-y-4">
            {lecture.practicePrompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Delivery formats
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {lecture.formats.map((format) => (
              <span
                key={format}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {format}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Asset progress
          </h2>
          <div className="mt-4">
            <LectureStatusTimeline lecture={lecture} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Tags
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {lecture.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/lectures"
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Return to library
          </Link>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
          >
            Customize delivery for my pace
          </Link>
        </div>
      </aside>
    </div>
  );
}
