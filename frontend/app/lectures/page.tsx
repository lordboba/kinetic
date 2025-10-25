import { ProtectedContent } from "@/components/auth/protected-content";
import { LectureCard } from "@/components/lectures/lecture-card";
import { mockLectures } from "@/lib/data/mockLectures";

export default function LecturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Lecture Library
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Remixable lecture templates crafted by the instructor + TA duo.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Each template showcases how Lecture Gen orchestrates transcripts,
          slides, diagrams, and voiceovers. Sign in to customize the pacing and
          modalities for your own cohort or personal study plan.
        </p>
      </div>

      <ProtectedContent>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {mockLectures.map((lecture) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </div>
      </ProtectedContent>
    </div>
  );
}
