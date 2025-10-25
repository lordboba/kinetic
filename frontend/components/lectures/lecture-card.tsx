import Link from "next/link";
import type { LectureAsset } from "@/lib/schemas/lecture";

export function LectureCard({ lecture }: { lecture: LectureAsset }) {
  const completionCount = lecture.progress.filter(
    (item) => item.status === "complete",
  ).length;
  const progressPercent = Math.round(
    (completionCount / lecture.progress.length) * 100,
  );

  return (
    <Link
      href={`/lectures/${lecture.id}`}
      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span>{lecture.durationMinutes} min</span>
          <span>•</span>
          <span>{lecture.formats.join(" • ")}</span>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-slate-900">
          {lecture.title}
        </h3>
        <p className="mt-3 text-sm text-slate-600">{lecture.tagline}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-400 transition-all group-hover:bg-sky-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {progressPercent}% of assets ready ·{" "}
          {lecture.progress.map((step) => step.label).join(", ")}
        </p>
        <div className="flex flex-wrap gap-2">
          {lecture.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
