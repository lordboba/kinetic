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
        } else {
          console.error("Failed to fetch lectures:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching lectures:", error);
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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  const handleCreateProject = () => {
    setIsCreatingProject(true);
    router.push("/lectures/new");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16">
        <header className="text-center">
          <h1 className="text-5xl font-bold text-slate-900">Hi {displayName}</h1>
          <p className="mt-4 text-2xl font-semibold text-slate-900">
            Ready to build your next lecture?
          </p>
          <p className="mt-4 text-base text-slate-600">
            Assemble immersive learning experiences with a personalized mix of
            walkthroughs, diagrams, and practice prompts.
          </p>
        </header>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={handleCreateProject}
            disabled={isCreatingProject}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-8 py-4 font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProject ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
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
                Create New Project
              </>
            )}
          </button>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-full border-2 border-slate-300 bg-white px-8 py-4 font-semibold text-slate-900 shadow-md transition hover:border-slate-400 hover:shadow-lg"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </Link>
        </div>
        <section className="mt-14">
          <div className="text-center md:flex md:items-end md:justify-between md:text-left">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Your Recent Lectures
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Pick up where you left off or dive into something new.
              </p>
            </div>
            {lectures.length > 0 && (
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400 md:mt-0">
                {lectures.length === 1
                  ? "1 lecture"
                  : `${lectures.length} lectures`}
              </p>
            )}
          </div>

          {lectures.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-16 text-center shadow-sm">
              <p className="mt-6 text-lg font-medium text-slate-900">
                No lectures yet
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Start by creating a new project to generate your first lecture.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {lectures.map((lecture) => (
                <Link
                  key={lecture.lecture_id}
                  href={`/mdx?id=${lecture.lecture_id}`}
                  className="group relative flex min-h-[160px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
                      <svg
                        className="h-6 w-6 text-sky-600"
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
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
                        {lecture.lecture_topic}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-sky-600 font-medium">
                    <span>View lecture</span>
                    <svg
                      className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
