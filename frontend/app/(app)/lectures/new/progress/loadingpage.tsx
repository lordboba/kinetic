"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreateLectureQuestion, CreateLectureStatusUpdate, CreateLectureAnswer } from "schema";
import { useAuth } from "@/components/auth/auth-provider";

type JobStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "completed"
  | "error";

type ClarifyingAnswersState = Record<string, string | string[]>;

type StoredConfig = {
  baseAnswers: Record<string, string>;
  clarifyingAnswers: ClarifyingAnswersState;
  clarifyingQuestions: CreateLectureQuestion[] | null;
  lectureStubId: string | null;
  createdAt: string;
};

export default function LectureProgressPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const configKey = searchParams.get("config");
  const { getIdToken } = useAuth();

  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);

  // Progress tracking state
  const [transcriptComplete, setTranscriptComplete] = useState(false);
  const [totalCounts, setTotalCounts] = useState({ images: 0, diagrams: 0, tts: 0 });
  const [progress, setProgress] = useState({ images: 0, diagrams: 0, tts: 0 });

  const headline = useMemo(() => {
    switch (status) {
      case "connecting":
        return "Connecting to the lecture stream…";
      case "connected":
        return "Generating your lecture…";
      case "completed":
        return "Lecture complete! Redirecting…";
      case "error":
        return "We hit a snag preparing your lecture.";
      default:
        return "Preparing lecture generation.";
    }
  }, [status]);

  useEffect(() => {
    if (!configKey) {
      setError("Missing lecture configuration. Please restart the flow.");
      setStatus("error");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storedConfig = sessionStorage.getItem(configKey);

    if (!storedConfig) {
      setError("We couldn’t find your responses. Please restart the flow.");
      setStatus("error");
      return;
    }

    let parsedConfig: StoredConfig | null = null;

    try {
      parsedConfig = JSON.parse(storedConfig) as StoredConfig;
    } catch (parseError) {
      console.error(parseError);
      setError("Your responses were corrupted. Please restart the flow.");
      setStatus("error");
      return;
    }

    setLectureId(parsedConfig.lectureStubId ?? null);

    let socket: WebSocket | null = null;

    const startLectureJob = async () => {
      setStatus("connecting");
      try {
        // Build answers array from stored config
        const answersArray = parsedConfig.clarifyingQuestions?.map(q => ({
          question_id: q.question_id,
          answer: parsedConfig.clarifyingAnswers[q.question_id]
        })) ?? [];

        // Get authentication token
        const token = await getIdToken();

        // Build WebSocket URL with proper parameters
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const params = new URLSearchParams({
          lecture_id: parsedConfig.lectureStubId!,
          answers: JSON.stringify(answersArray),
          token: token
        });
        const socketUrl = `${protocol}://${window.location.host}/api/lecture?${params}`;

        socket = new WebSocket(socketUrl);
        socket.onopen = () => setStatus("connected");
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as CreateLectureStatusUpdate;

            switch (data.type) {
              case "completedOne":
                if (data.completed === "transcript") {
                  setTranscriptComplete(true);
                } else {
                  // Update progress counter for images/diagrams/tts
                  setProgress(prev => ({ ...prev, [data.completed]: data.counter }));
                }
                break;

              case "enumerated":
                // Set total counts for images/diagrams/tts
                setTotalCounts(prev => ({ ...prev, [data.thing]: data.total }));
                break;

              case "completedAll":
                setStatus("completed");
                // Redirect to lecture display page
                setTimeout(() => {
                  router.push(`/lectures/${parsedConfig.lectureStubId}`);
                }, 1500);
                break;
            }
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };
        socket.onerror = (event) => {
          console.error(event);
          setError("WebSocket connection failed.");
          setStatus("error");
        };
      } catch (jobError) {
        console.error(jobError);
        setError(
          "We couldn't start the lecture generation. Please try again.",
        );
        setStatus("error");
      }
    };

    startLectureJob();

    return () => {
      if (socket) {
        socket.close();
      }
      sessionStorage.removeItem(configKey);
    };
  }, [configKey]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-start justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Lecture Generation
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">{headline}</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Watch as your lecture comes to life. We&apos;re generating the transcript,
          finding images, creating diagrams, and synthesizing voiceovers in real-time.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {status === "connected" && (
        <div className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Generation Progress</h2>

          {/* Transcript */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Transcript</span>
            {transcriptComplete ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Complete
              </span>
            ) : (
              <span className="text-sm text-slate-500">Generating...</span>
            )}
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Images</span>
              <span className="text-sm font-semibold text-slate-900">
                {progress.images} / {totalCounts.images}
              </span>
            </div>
            {totalCounts.images > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${(progress.images / totalCounts.images) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Diagrams */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Diagrams</span>
              <span className="text-sm font-semibold text-slate-900">
                {progress.diagrams} / {totalCounts.diagrams}
              </span>
            </div>
            {totalCounts.diagrams > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${(progress.diagrams / totalCounts.diagrams) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Voiceovers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Voiceovers</span>
              <span className="text-sm font-semibold text-slate-900">
                {progress.tts} / {totalCounts.tts}
              </span>
            </div>
            {totalCounts.tts > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(progress.tts / totalCounts.tts) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {status === "completed" && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-6">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold text-green-900">Lecture complete!</p>
            <p className="text-sm text-green-700">Redirecting you to your lecture...</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/lectures/new")}
        className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      >
        Back to questionnaire
      </button>
    </div>
  );
}
