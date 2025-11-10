"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreateLectureQuestion, CreateLectureStatusUpdate, CreateLectureAnswer } from "schema";
import { useAuth } from "@/components/auth/auth-provider";
import { createLogger } from "@/lib/logger";
import { getBackendEndpoint } from "@/lib/env";

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

const STREAMING_AUDIO_ENABLED = true;

type AssetKey = "images" | "diagrams" | "tts";

const ASSET_LABELS: Record<AssetKey, string> = {
  images: "Images",
  diagrams: "Diagrams",
  tts: "Voiceovers",
};
const ACTIVE_ASSET_ORDER: AssetKey[] = STREAMING_AUDIO_ENABLED
  ? ["images", "diagrams"]
  : ["images", "diagrams", "tts"];

const logger = createLogger('Kinetic Progress');

export default function LectureProgressPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const configKey = searchParams.get("config");
  const { getIdToken } = useAuth();

  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const hasRedirectedRef = useRef(false);

  // Progress tracking state
  const [transcriptComplete, setTranscriptComplete] = useState(false);
  const [totalCounts, setTotalCounts] = useState<Record<AssetKey, number | null>>({
    images: null,
    diagrams: null,
    tts: null,
  });
  const [progress, setProgress] = useState<Record<AssetKey, number>>({
    images: 0,
    diagrams: 0,
    tts: 0,
  });

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

  const manualRedirect = () => {
    if (!lectureId) {
      return;
    }
    const targetUrl = `/mdx?id=${encodeURIComponent(lectureId)}`;
    try {
      router.replace(targetUrl);
    } catch (navError) {
      logger.error('Manual navigation failed, hard reloading', {
        error: navError,
        targetUrl,
      });
      if (typeof window !== "undefined") {
        window.location.href = targetUrl;
      }
    }
  };

  useEffect(() => {
    logger.info('Page loaded', {
      timestamp: new Date().toISOString(),
      configKey,
    });

    if (!configKey) {
      logger.error('Missing config key in URL params');
      setError("Missing lecture configuration. Please restart the flow.");
      setStatus("error");
      return;
    }

    if (typeof window === "undefined") {
      logger.debug('Window is undefined (SSR), skipping');
      return;
    }

    logger.info('Reading config from sessionStorage', {
      configKey,
    });

    const storedConfig = sessionStorage.getItem(configKey);

    if (!storedConfig) {
      logger.error('Config not found in sessionStorage', {
        configKey,
      });
      setError("We couldn't find your responses. Please restart the flow.");
      setStatus("error");
      return;
    }

    logger.info('Config retrieved from sessionStorage', {
      configKey,
      payloadSize: storedConfig.length,
    });

    let parsedConfig: StoredConfig | null = null;

    try {
      parsedConfig = JSON.parse(storedConfig) as StoredConfig;
      logger.info('Config parsed successfully', {
        lectureStubId: parsedConfig.lectureStubId,
        questionCount: parsedConfig.clarifyingQuestions?.length ?? 0,
        createdAt: parsedConfig.createdAt,
      });
    } catch (parseError) {
      logger.error('Failed to parse config from sessionStorage', {
        error: parseError,
        configKey,
      });
      setError("Your responses were corrupted. Please restart the flow.");
      setStatus("error");
      return;
    }

    setLectureId(parsedConfig.lectureStubId ?? null);

    let socket: WebSocket | null = null;
    let didStart = false;

    const startLectureJob = async () => {
      if (didStart) {
        logger.debug('Job already started, skipping duplicate execution');
        return;
      }
      didStart = true;
      logger.info('Starting lecture job', {
        timestamp: new Date().toISOString(),
        lectureStubId: parsedConfig.lectureStubId,
        questionCount: parsedConfig.clarifyingQuestions?.length ?? 0,
      });

      setStatus("connecting");
      try {
        // Build answers array from stored config
        const answersArray = parsedConfig.clarifyingQuestions?.map(q => ({
          question_id: q.question_id,
          answer: parsedConfig.clarifyingAnswers[q.question_id]
        })) ?? [];

        logger.info('Built answers array', {
          answerCount: answersArray.length,
        });

        // Get authentication token
        const token = await getIdToken();
        logger.info('Retrieved authentication token');

        // Build WebSocket URL with proper parameters
        const backendEndpoint = getBackendEndpoint();
        const params = new URLSearchParams({
          lecture_id: parsedConfig.lectureStubId!,
          answers: JSON.stringify(answersArray),
          token: token
        });
        if (STREAMING_AUDIO_ENABLED) {
          params.set("supports_streaming_audio", "1");
        }
        let socketUrl: string;
        try {
          const baseUrl = backendEndpoint.startsWith("http")
            ? backendEndpoint
            : `http://${backendEndpoint}`;
          const wsUrl = new URL(baseUrl);
          wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
          wsUrl.pathname = "/api/lecture";
          wsUrl.search = params.toString();
          socketUrl = wsUrl.toString();

          logger.info('WebSocket URL constructed', {
            protocol: wsUrl.protocol,
            host: wsUrl.host,
            lectureId: parsedConfig.lectureStubId,
            answerCount: answersArray.length,
            url: socketUrl,
          });
        } catch (urlError) {
          logger.error('Failed to construct WebSocket URL', {
            error: urlError,
            backendEndpoint,
          });
          throw urlError;
        }

        logger.info('Initiating WebSocket connection to /api/lecture', {
          timestamp: new Date().toISOString(),
        });

        socket = new WebSocket(socketUrl);

        socket.onopen = () => {
          logger.info('WebSocket connection opened', {
            timestamp: new Date().toISOString(),
            lectureId: parsedConfig.lectureStubId,
          });
          setStatus("connected");
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as CreateLectureStatusUpdate;
            logger.info('WebSocket message received', {
              timestamp: new Date().toISOString(),
              messageType: data.type,
              data,
            });

            switch (data.type) {
              case "completedOne":
                logger.info('Item completed', {
                  completed: data.completed,
                  counter: 'counter' in data ? data.counter : undefined,
                });
                if (data.completed === "transcript") {
                  setTranscriptComplete(true);
                } else {
                  if (typeof data.counter === "number") {
                    // Update progress counter
                    setProgress(prev => ({
                      ...prev,
                      [data.completed]:
                        Math.max(prev[data.completed], data.counter),
                    }));
                  } else {
                    logger.warn('Missing counter for non-transcript completion', {
                      completed: data.completed,
                      data,
                    });
                  }
                }
                break;

              case "enumerated":
                logger.info('Total enumerated', {
                  thing: data.thing,
                  total: data.total,
                });
                // Set total counts
                setTotalCounts(prev => ({
                  ...prev,
                  [data.thing]: data.total,
                }));
                break;

              case "completedAll":
                logger.info('All items completed', {
                  timestamp: new Date().toISOString(),
                  lectureId: parsedConfig.lectureStubId,
                });
                setStatus("completed");
                // Clean up sessionStorage now that we're done
                if (typeof window !== "undefined" && configKey) {
                  sessionStorage.removeItem(configKey);
                  logger.info('Cleaned up sessionStorage', {
                    configKey,
                  });
                }
                if (!parsedConfig.lectureStubId) {
                  logger.error('Missing lectureStubId on completion, cannot redirect', {
                    parsedConfig,
                  });
                  setError(
                    "We finished generating your lecture, but couldn't locate it. Please return to your dashboard.",
                  );
                  setStatus("error");
                  break;
                }

                const targetUrl = `/mdx?id=${encodeURIComponent(parsedConfig.lectureStubId)}`;

                const performRedirect = () => {
                  if (hasRedirectedRef.current) {
                    return;
                  }
                  hasRedirectedRef.current = true;

                  logger.info('Redirecting to MDX lecture viewer', {
                    targetUrl,
                  });

                  try {
                    router.replace(targetUrl);
                  } catch (navError) {
                    logger.error('Client navigation failed, falling back to hard redirect', {
                      error: navError,
                      targetUrl,
                    });
                    if (typeof window !== "undefined") {
                      window.location.href = targetUrl;
                    }
                  }
                };

                if (typeof window !== "undefined") {
                  redirectTimeoutRef.current = window.setTimeout(() => {
                    performRedirect();
                  }, 1500);
                } else {
                  performRedirect();
                }
                break;
            }
          } catch (err) {
            logger.error('Failed to parse WebSocket message', {
              error: err,
              rawData: event.data,
            });
          }
        };

        socket.onerror = (event) => {
          logger.error('WebSocket error', {
            timestamp: new Date().toISOString(),
            event,
          });
          setError("WebSocket connection failed.");
          setStatus("error");
        };

        socket.onclose = (event) => {
          logger.info('WebSocket connection closed', {
            timestamp: new Date().toISOString(),
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        };
      } catch (jobError) {
        logger.error('Error starting lecture job', {
          error: jobError,
        });
        setError(
          "We couldn't start the lecture generation. Please try again.",
        );
        setStatus("error");
      }
    };

    startLectureJob();

    return () => {
      logger.debug('Cleanup: closing WebSocket', {
        timestamp: new Date().toISOString(),
        hasSocket: !!socket,
      });
      if (socket) {
        socket.close();
      }
      if (redirectTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      // Note: We intentionally do NOT remove from sessionStorage here
      // because React Strict Mode runs effects twice in development,
      // which would cause the second run to fail when the first cleanup
      // removes the item. We'll rely on sessionStorage's session-based
      // cleanup or remove it after successful completion.
    };
  }, [configKey, getIdToken]);

  const renderAssetProgress = (key: AssetKey) => {
    const total = totalCounts[key];
    const completed = progress[key];
    const hasTotal = typeof total === "number";
    const requiresWork = hasTotal && total > 0;
    const percent = requiresWork
      ? Math.min((completed / total) * 100, 100)
      : 0;
    const isComplete =
      status === "completed" &&
      hasTotal &&
      (total === 0 || completed >= total);

    let indicator: ReactNode;
    if (isComplete) {
      indicator = (
        <svg
          className="h-5 w-5 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    } else if (!hasTotal) {
      indicator = (
        <svg
          className="h-5 w-5 animate-spin text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      );
    } else if (requiresWork) {
      indicator = (
        <span className="text-xs font-medium text-slate-500">
          {completed} / {total}
        </span>
      );
    } else {
      indicator = (
        <span className="text-xs font-medium text-slate-500">
          No items required
        </span>
      );
    }

    const spinnerActive =
      status === "connected" &&
      !isComplete &&
      (!hasTotal || (requiresWork && completed < total));

    const spinnerBox = spinnerActive ? (
      <div
        aria-hidden
        className="h-5 w-5 rounded-md border-2 border-indigo-200 border-r-indigo-500 border-t-indigo-500 animate-spin"
      />
    ) : (
      <div
        aria-hidden
        className="h-5 w-5 rounded-md border border-slate-200 bg-slate-100"
      />
    );

    let progressBar: ReactNode;
    if (!hasTotal) {
      progressBar = (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-200" />
        </div>
      );
    } else if (requiresWork) {
      progressBar = (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      );
    } else {
      progressBar = (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-full rounded-full bg-slate-200" />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            {ASSET_LABELS[key]}
          </span>
          {indicator}
        </div>
        <div className="flex items-center gap-3">
          {spinnerBox}
          <div className="flex-1">{progressBar}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-start justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Lecture Generation
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">{headline}</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Watch as your lecture comes to life. We&apos;re generating the transcript,
          finding images, and creating diagrams in real-time. Narration streams directly
          in the lecture viewer as it is produced.
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
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-6 w-6 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>

          {ACTIVE_ASSET_ORDER.map(renderAssetProgress)}
        </div>
      )}

      {status === "completed" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-green-200 bg-green-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <svg className="mt-1 h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-green-900">Lecture complete!</p>
              <p className="text-sm text-green-700">
                Redirecting you to your lecture. If nothing happens, jump there manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={manualRedirect}
            disabled={!lectureId}
            className="inline-flex items-center justify-center rounded-full border border-green-300 bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:border-green-200 disabled:bg-green-200 disabled:text-green-500"
          >
            Open lecture viewer
          </button>
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
