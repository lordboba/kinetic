"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lecture {
  lecture_id: string;
  lecture_topic: string;
}

export default function DashboardPage() {
  const { user, loading, getIdToken } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [deletingLectureId, setDeletingLectureId] = useState<string | null>(
    null
  );
  const displayName =
    user?.displayName?.split(" ")[0] ??
    (user?.email ? user.email.split("@")[0] : "there");

  useEffect(() => {
    async function fetchLectures() {
      if (!user) return;

      try {
        const token = await getIdToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/get_lectures`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setLectures(data.lectures || []);
          setDashboardError(null);
        } else {
          console.error("Failed to fetch lectures:", response.statusText);
          setDashboardError("Failed to fetch your lectures. Please try again.");
        }
      } catch (error) {
        console.error("Error fetching lectures:", error);
        setDashboardError("Unexpected error loading lectures.");
      } finally {
        setLoadingLectures(false);
      }
    }

    if (user && !loading) {
      fetchLectures();
    }
  }, [user, loading, getIdToken]);

  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  if (loading || loadingLectures) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-primary" />
      </div>
    );
  }

  const handleCreateProject = () => {
    setIsCreatingProject(true);
    router.push("/lectures/new");
  };

  const handleDeleteLecture = async (
    lectureId: string,
    lectureTopic: string
  ) => {
    const confirmDelete = window.confirm(
      `Delete lecture "${lectureTopic}"? This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setDashboardError(null);
    setDeletingLectureId(lectureId);

    try {
      const token = await getIdToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/lectures/${lectureId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to delete lecture.";
        try {
          const data = await response.json();
          if (data?.error) {
            errorMessage = data.error;
          }
        } catch {
          // ignore JSON parsing errors
        }
        throw new Error(errorMessage);
      }

      setLectures((prev) =>
        prev.filter((lecture) => lecture.lecture_id !== lectureId)
      );
    } catch (error) {
      console.error("Error deleting lecture:", error);
      setDashboardError(
        error instanceof Error ? error.message : "Failed to delete lecture."
      );
    } finally {
      setDeletingLectureId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-20">
        
        {/* Hero Section */}
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary mb-6">
            👋 Welcome back
          </div>
          <h1 className="text-6xl font-bold text-slate-900 tracking-tight">
            Greetings, {displayName}!
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            Are you ready to dive into learning?
          </p>
        </header>

        {/* CTA Button */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={handleCreateProject}
            disabled={isCreatingProject}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-primary to-orange-600 px-10 py-5 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-2xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProject ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating your lecture...
              </>
            ) : (
              <>
                <svg
                  className="h-6 w-6 transition-transform group-hover:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Lecture
              </>
            )}
          </button>
        </div>

        {/* Lectures Section */}
        <section className="mt-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                Your Recent Lectures
              </h2>
              <p className="mt-2 text-slate-600">
                Pick up where you left off or dive into something new.
              </p>
            </div>
            {lectures.length > 0 && (
              <span className="rounded-full bg-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-700">
                {lectures.length} {lectures.length === 1 ? "lecture" : "lectures"}
              </span>
            )}
          </div>
          {dashboardError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dashboardError}
            </div>
          )}

          {lectures.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-20 text-center shadow-sm">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <svg
                  className="h-10 w-10 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="mt-6 text-xl font-semibold text-slate-900">
                No lectures yet
              </p>
              <p className="mt-2 text-slate-500">
                Click the button above to create your first personalized lecture.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {lectures.map((lecture) => (
                <div
                  key={lecture.lecture_id}
                  className="group relative flex min-h-[180px] flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-2 hover:shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteLecture(
                        lecture.lecture_id,
                        lecture.lecture_topic
                      )
                    }
                    disabled={deletingLectureId === lecture.lecture_id}
                    className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Delete lecture ${lecture.lecture_topic}`}
                  >
                    {deletingLectureId === lecture.lecture_id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                  <Link
                    href={`/mdx?id=${lecture.lecture_id}`}
                    className="flex h-full w-full flex-col justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-orange-100">
                        <svg
                          className="h-7 w-7 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-2 leading-snug">
                        {lecture.lecture_topic}
                      </h3>
                    </div>

                    <div className="mt-6 flex items-center text-sm font-semibold text-primary">
                      <span>View lecture</span>
                      <svg
                        className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
