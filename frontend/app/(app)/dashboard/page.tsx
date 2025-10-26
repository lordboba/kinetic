"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBackendEndpoint } from "@/lib/env";

interface Lecture {
  id: string;
  title: string;
  createdAt: string;
  progress: number;
}

interface Folder {
  id: string;
  name: string;
  lectures: Lecture[];
  subfolders: Folder[];
  isExpanded?: boolean;
}

const mockFolders: Folder[] = [
  {
    id: "1",
    name: "Machine Learning",
    lectures: [
      {
        id: "adaptive-neural-networks",
        title: "Adaptive Neural Networks",
        createdAt: "2025-01-15",
        progress: 75,
      },
    ],
    subfolders: [
      {
        id: "1-1",
        name: "Deep Learning",
        lectures: [
          {
            id: "dl-basics",
            title: "Deep Learning Fundamentals",
            createdAt: "2025-01-10",
            progress: 100,
          },
        ],
        subfolders: [],
      },
    ],
  },
  {
    id: "2",
    name: "Quantum Computing",
    lectures: [
      {
        id: "applied-quantum-computing",
        title: "Applied Quantum Computing",
        createdAt: "2025-01-12",
        progress: 60,
      },
    ],
    subfolders: [],
  },
];

function FolderItem({
  folder,
  onToggle,
  depth = 0,
}: {
  folder: Folder;
  onToggle: (folderId: string) => void;
  depth?: number;
}) {
  const totalItems = folder.lectures.length + folder.subfolders.length;
  const hasChildren = totalItems > 0;
  const isRoot = depth === 0;
  const containerClasses = isRoot
    ? "group relative flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    : "flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <div className={containerClasses}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
            <svg
              className="h-5 w-5 text-sky-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {folder.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {totalItems === 1 ? "1 item" : `${totalItems} items`}
            </p>
          </div>
        </div>

        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(folder.id)}
            aria-expanded={Boolean(folder.isExpanded)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${
                folder.isExpanded ? "rotate-90" : ""
              }`}
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
          </button>
        )}
      </div>

      {folder.isExpanded && (
        <div className="mt-6 space-y-3">
          {folder.lectures.map((lecture) => (
            <Link
              key={lecture.id}
              href={`/lectures/${lecture.id}`}
              className="group/lecture flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition hover:border-sky-300 hover:bg-white hover:shadow-sm"
            >
              <svg
                className="h-5 w-5 text-slate-400 transition group-hover/lecture:text-sky-500"
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
              <div className="flex-1">
                <p className="font-medium text-slate-900">{lecture.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(lecture.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${lecture.progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {lecture.progress}%
                </span>
              </div>
            </Link>
          ))}

          {folder.subfolders.length > 0 && (
            <div className="space-y-3">
              {folder.subfolders.map((subfolder) => (
                <FolderItem
                  key={subfolder.id}
                  folder={subfolder}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>(mockFolders);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const displayName =
    user?.displayName?.split(" ")[0] ??
    (user?.email ? user.email.split("@")[0] : "there");

  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  const toggleFolder = (folderId: string) => {
    const updateFolders = (folders: Folder[]): Folder[] => {
      return folders.map((folder) => {
        if (folder.id === folderId) {
          return { ...folder, isExpanded: !folder.isExpanded };
        }
        if (folder.subfolders.length > 0) {
          return {
            ...folder,
            subfolders: updateFolders(folder.subfolders),
          };
        }
        return folder;
      });
    };
    setFolders((prev) => updateFolders(prev));
  };

  const handleCreateProject = async () => {
    setIsCreatingProject(true);
    setCreateError(null);
    let backendEndpoint: string | null = null;
    try {
      backendEndpoint = getBackendEndpoint();
    } catch (error) {
      console.warn("Backend endpoint not configured; skipping project API.", error);
    }

    try {
      if (backendEndpoint) {
        const response = await fetch(`${backendEndpoint}create-project`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Add necessary payload
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create project (${response.status})`);
        }

        const data = await response.json();
        console.log("Project created:", data);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      setCreateError(
        "We couldn’t spin up your project. Please try again shortly.",
      );
    } finally {
      setIsCreatingProject(false);
      router.push("/lectures/new");
    }
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

        <div className="mt-10 flex justify-center">
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
        </div>
        {createError ? (
          <p className="mt-4 text-center text-sm text-red-600">{createError}</p>
        ) : null}

        <section className="mt-14">
          <div className="text-center md:flex md:items-end md:justify-between md:text-left">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Your Projects
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Pick up where you left off or dive into something new.
              </p>
            </div>
            {folders.length > 0 && (
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400 md:mt-0">
                {folders.length === 1
                  ? "1 collection"
                  : `${folders.length} collections`}
              </p>
            )}
          </div>

          {folders.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50">
                <svg
                  className="h-8 w-8 text-sky-500"
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
              </div>
              <p className="mt-6 text-lg font-medium text-slate-900">
                No projects yet
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Start by creating a new project to generate your first lecture
                path.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  onToggle={toggleFolder}
                  depth={0}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
