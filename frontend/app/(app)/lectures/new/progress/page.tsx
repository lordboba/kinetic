"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreateLectureQuestion } from "schema";

type JobStatus =
  | "idle"
  | "starting"
  | "connecting"
  | "connected"
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

  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);

  const headline = useMemo(() => {
    switch (status) {
      case "starting":
        return "Spinning up the instructor duo…";
      case "connecting":
        return "Connecting to the lecture stream…";
      case "connected":
        return "Lecture assets are on the way.";
      case "error":
        return "We hit a snag preparing your lecture.";
      default:
        return "Preparing lecture generation handoff.";
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
      setStatus("starting");
      try {
        const response = await fetch("/api/newLecture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lectureStubId: parsedConfig?.lectureStubId,
            topic:
              parsedConfig?.baseAnswers?.["lecture-topic"] ?? "Custom lecture",
            baseAnswers: parsedConfig?.baseAnswers,
            clarifyingAnswers: parsedConfig?.clarifyingAnswers,
            clarifyingQuestions: parsedConfig?.clarifyingQuestions,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to create lecture job (${response.statusText})`,
          );
        }

        const payload = (await response.json()) as { id?: string };
        const jobId = payload?.id;

        if (!jobId) {
          throw new Error("Lecture job missing identifier.");
        }

        setLectureId(jobId);
        setStatus("connecting");

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const socketUrl = `${protocol}://${window.location.host}/api/lecture?id=${jobId}`;

        socket = new WebSocket(socketUrl);
        socket.onopen = () => setStatus("connected");
        socket.onmessage = (event) =>
          console.debug("lecture-progress", event.data);
        socket.onerror = (event) => {
          console.error(event);
          setError("WebSocket connection failed. TODO: add retry logic.");
          setStatus("error");
        };
      } catch (jobError) {
        console.error(jobError);
        setError(
          "We couldn’t start the lecture generation. TODO: show recovery options.",
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
          TODO: Build the real-time lecture assembly view. For now we&apos;re
          capturing the responses you shared and initiating the backend job +
          websocket connection.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Status</span>
          <span className="font-semibold text-slate-900">{status}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Lecture ID</span>
          <span className="font-mono text-xs text-slate-500">
            {lectureId ?? "pending…"}
          </span>
        </div>
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>

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
