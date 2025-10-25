import type { LectureAsset } from "@/lib/schemas/lecture";

const statusStyles: Record<
  LectureAsset["progress"][number]["status"],
  { indicator: string; text: string }
> = {
  complete: {
    indicator: "bg-emerald-500 ring-emerald-500/20",
    text: "text-emerald-600",
  },
  "in-progress": {
    indicator: "bg-sky-500 ring-sky-500/20",
    text: "text-sky-600",
  },
  pending: {
    indicator: "bg-slate-300 ring-slate-300/40",
    text: "text-slate-500",
  },
};

export function LectureStatusTimeline({
  lecture,
}: {
  lecture: LectureAsset;
}) {
  return (
    <ol className="space-y-4">
      {lecture.progress.map((step) => {
        const styles = statusStyles[step.status];
        return (
          <li key={step.key} className="flex items-start gap-4">
            <span
              className={`mt-1 inline-flex h-3 w-3 shrink-0 rounded-full ring-4 ${styles.indicator}`}
            />
            <div>
              <p className={`text-sm font-semibold ${styles.text}`}>
                {step.label}
              </p>
              <p className="text-sm text-slate-600">
                Status: {step.status}
                {step.etaMinutes
                  ? ` · ~${step.etaMinutes} min remaining`
                  : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
