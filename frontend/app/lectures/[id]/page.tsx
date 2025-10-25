import Link from "next/link";
import { notFound } from "next/navigation";
import { ProtectedContent } from "@/components/auth/protected-content";
import { LectureDetail } from "@/components/lectures/lecture-detail";
import { getLectureById } from "@/lib/data/mockLectures";

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lecture = getLectureById(id);

  if (!lecture) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/lectures" className="hover:text-slate-900">
          Lectures
        </Link>
        <span>/</span>
        <span className="text-slate-900">{lecture.title}</span>
      </div>

      <ProtectedContent>
        <LectureDetail lecture={lecture} />
      </ProtectedContent>
    </div>
  );
}
