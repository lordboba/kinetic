"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CreateLectureQuestion } from "schema";
import { getBackendEndpoint } from "@/lib/env";
import { useAuth } from "@/components/auth/auth-provider";

type AnswersState = Record<string, string>;
type ClarifyingAnswerValue = string | string[];
type ClarifyingAnswersState = Record<string, ClarifyingAnswerValue>;

type StoredLectureConfig = {
  baseAnswers: AnswersState;
  clarifyingAnswers: ClarifyingAnswersState;
  clarifyingQuestions: CreateLectureQuestion[] | null;
  lectureStubId: string | null;
  createdAt: string;
};

function buildInitialAnswers(): AnswersState {
  return { "lecture-topic": "" };
}

type ClarifyingQuestionCardProps = {
  question: CreateLectureQuestion;
  value: ClarifyingAnswerValue | undefined;
  onChange: (value: ClarifyingAnswerValue) => void;
};

function ClarifyingQuestionCard({
  question,
  value,
  onChange,
}: ClarifyingQuestionCardProps) {
  const isAnswered =
    question.question_type === "checkbox"
      ? Array.isArray(value) && value.length > 0
      : typeof value === "string" && value.trim().length > 0;

  return (
    <div
      className={`rounded-2xl border p-6 transition ${
        isAnswered
          ? "border-slate-900 shadow-lg shadow-slate-900/5"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Instructor follow-up
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            {question.question}
          </h3>
        </div>
        <span className="text-xs font-medium text-slate-400">
          {isAnswered ? "Captured" : "Pending"}
        </span>
      </div>

      {question.question_type === "radio" && question.options ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {question.options.map((option) => {
            const isSelected =
              typeof value === "string" && value === option.option_id;
            return (
              <button
                key={option.option_id}
                type="button"
                onClick={() => onChange(option.option_id)}
                className={`flex h-full flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="text-sm font-medium">{option.text}</span>
                {isSelected ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Selected
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {question.question_type === "checkbox" && question.options ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {question.options.map((option) => {
            const currentValue = Array.isArray(value) ? value : [];
            const isSelected = currentValue.includes(option.option_id);
            return (
              <button
                key={option.option_id}
                type="button"
                onClick={() => {
                  const nextValue = isSelected
                    ? currentValue.filter((id) => id !== option.option_id)
                    : [...currentValue, option.option_id];
                  onChange(nextValue);
                }}
                className={`flex h-full flex-col rounded-xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{option.text}</span>
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs transition ${
                      isSelected
                        ? "border-transparent bg-white/20 text-white"
                        : "border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {question.question_type === "text_input" ? (
        <textarea
          id={question.question_id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder="Share your thoughts or extra context…"
          className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      ) : null}
    </div>
  );
}

type LecturePreferences = {
  lecture_length: "short" | "medium" | "long";
  tone: "direct" | "warm" | "funny";
  enable_questions: boolean;
};

export default function LectureConfiguratorPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [answers, setAnswers] = useState<AnswersState>(() =>
    buildInitialAnswers(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] =
    useState<CreateLectureQuestion[] | null>(null);
  const [clarifyingAnswers, setClarifyingAnswers] =
    useState<ClarifyingAnswersState>({});
  const [clarifyingError, setClarifyingError] = useState<string | null>(null);
  const [isGeneratingClarifying, setIsGeneratingClarifying] = useState(false);
  const [lectureStubId, setLectureStubId] = useState<string | null>(null);
  const [clarifyingFiles, setClarifyingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [defaultPreferences, setDefaultPreferences] =
    useState<LecturePreferences | null>(null);
  const [customPreferences, setCustomPreferences] =
    useState<LecturePreferences | null>(null);
  const [showPreferencesCustomization, setShowPreferencesCustomization] =
    useState(false);

  // Fetch user's default preferences
  useEffect(() => {
    async function fetchPreferences() {
      if (!user) return;

      try {
        const token = await getIdToken();
        const response = await fetch(
          `${getBackendEndpoint()}users/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.profile) {
            setDefaultPreferences(data.profile.preferences);
          }
        }
      } catch (error) {
        console.error("Error fetching preferences:", error);
      }
    }

    if (user) {
      fetchPreferences();
    }
  }, [user, getIdToken]);

  const completionRatio = useMemo(() => {
    const baseTotal = Object.keys(answers).length;
    const baseCompleted = Object.values(answers).filter((value) =>
      value.trim(),
    ).length;

    const clarifyingTotal = clarifyingQuestions?.length ?? 0;
    const clarifyingCompleted =
      clarifyingQuestions?.reduce((count, question) => {
        const response = clarifyingAnswers[question.question_id];
        if (question.question_type === "checkbox") {
          return count + (Array.isArray(response) && response.length > 0 ? 1 : 0);
        }
        if (typeof response === "string" && response.trim()) {
          return count + 1;
        }
        return count;
      }, 0) ?? 0;

    const total = baseTotal + clarifyingTotal;
    const completed = baseCompleted + clarifyingCompleted;
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [answers, clarifyingAnswers, clarifyingQuestions]);

  const updateAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setClarifyingFiles((prev) => {
      const existingKeys = new Set(
        prev.map(
          (file) => `${file.name}-${file.size}-${file.lastModified}`,
        ),
      );
      const merged = [...prev];

      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(key)) {
          merged.push(file);
          existingKeys.add(key);
        }
      }

      return merged;
    });
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    addFiles(selectedFiles);
    event.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const removeFileAtIndex = (index: number) => {
    setClarifyingFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const generateClarifyingQuestions = useCallback(async () => {
    const topic = answers["lecture-topic"]?.trim();

    if (!topic) {
      setClarifyingError(
        "Add a lecture topic so the instructor duo knows what to ask.",
      );
      return;
    }

    let backendEndpoint: string;

    try {
      backendEndpoint = getBackendEndpoint();
    } catch (endpointError) {
      console.error(endpointError);
      setClarifyingError(
        "Backend endpoint is not configured. Set BACKEND_ENDPOINT to continue.",
      );
      return;
    }

    if (!user) {
      setClarifyingError(
        "Sign in to generate clarifying questions for this lecture.",
      );
      return;
    }

    setIsGeneratingClarifying(true);
    setClarifyingError(null);

    try {
      let token: string | null = null;
      try {
        token = await user.getIdToken();
      } catch (tokenError) {
        console.error(tokenError);
        setClarifyingError(
          "We couldn’t verify your account. Refresh and sign in again.",
        );
        return;
      }

      const formData = new FormData();
      formData.append(
        "lecture_config",
        JSON.stringify({
          lecture_topic: topic,
        }),
      );

      // Include custom preferences if they've been set
      if (customPreferences) {
        formData.append(
          "lecture_preferences",
          JSON.stringify(customPreferences)
        );
      }

      clarifyingFiles.forEach((file) => {
        formData.append("files", file);
      });

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${backendEndpoint}create-lecture-initial`,
        {
          method: "POST",
          headers,
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to generate questions (${response.status})`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        lecture_id?: string;
        questions?: CreateLectureQuestion[];
      };

      if (payload.error) {
        throw new Error(payload.error);
      }

      const nextQuestions = payload.questions ?? [];
      setLectureStubId(payload.lecture_id ?? null);
      setClarifyingQuestions(nextQuestions);
      setClarifyingAnswers(
        nextQuestions.reduce<ClarifyingAnswersState>((acc, question) => {
          if (question.question_type === "checkbox") {
            acc[question.question_id] = [];
          } else {
            acc[question.question_id] = "";
          }
          return acc;
        }, {}),
      );
    } catch (requestError) {
      console.error(requestError);
      setClarifyingError(
        "We couldn’t fetch clarifying questions. Please try again in a moment.",
      );
      setClarifyingQuestions(null);
      setClarifyingAnswers({});
      setLectureStubId(null);
    } finally {
      setIsGeneratingClarifying(false);
    }
  }, [answers, clarifyingFiles, user]);

  const persistConfig = (
    baseAnswers: AnswersState,
    clarifying: ClarifyingAnswersState,
  ) => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const storageKey = `lecture-config-${Date.now()}`;
      const enrichedPayload: StoredLectureConfig = {
        baseAnswers,
        clarifyingAnswers: clarifying,
        clarifyingQuestions,
        lectureStubId,
        createdAt: new Date().toISOString(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(enrichedPayload));
      return storageKey;
    } catch (storageError) {
      console.error(storageError);
      return null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const storageKey = persistConfig(answers, clarifyingAnswers);

    if (!storageKey) {
      setError("We couldn’t prepare your lecture handoff. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/lectures/new/progress?config=${storageKey}`);
  };

  return (
    <div className="bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Lecture Generation
              </p>
              <h1 className="mt-2 text-4xl font-semibold text-slate-900">
                Shape the instructor brief.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600">
                Answer a few prompts so the instructor + TA agents can tune
                pacing, visuals, and practice to your learners. You can adjust
                anything later once assets begin streaming in.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 sm:items-end">
              <span className="uppercase tracking-widest text-slate-400">
                Progress
              </span>
              <span className="text-lg font-semibold text-slate-900">
                {completionRatio}%
              </span>
              <span className="text-xs text-slate-500">
                {completionRatio === 100
                  ? "Ready to handoff."
                  : "Complete the prompts to give agents context."}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-14"
      >
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Lecture seed
              </h2>
              <p className="max-w-3xl text-sm text-slate-600">
                Set the lecture topic and attach any notes or references. We’ll
                feed these into the clarifying question request once you’re
                ready.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
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
                  d="M12 16v-8m-4 4h8"
                />
              </svg>
              Add files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileSelection}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <label
                htmlFor="lecture-seed-topic"
                className="block text-sm font-semibold text-slate-700"
              >
                Lecture topic
              </label>
              <p className="mt-1 text-xs text-slate-500">
                A concise title helps the instructor duo stay focused. You can
                revise it later.
              </p>
              <input
                id="lecture-seed-topic"
                type="text"
                value={answers["lecture-topic"] ?? ""}
                onChange={(event) =>
                  updateAnswer("lecture-topic", event.target.value)
                }
                placeholder="e.g. Gradient descent intuition for product engineers"
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Reference files
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click or drag files to upload PDFs, slides, docs, or code
                    snippets.
                  </p>
                </div>
                {clarifyingFiles.length > 0 ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {clarifyingFiles.length}
                  </span>
                ) : null}
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`mt-5 cursor-pointer rounded-xl border border-dashed px-4 py-6 transition ${
                  isDragging
                    ? "border-slate-900 bg-slate-100"
                    : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
                }`}
              >
                {clarifyingFiles.length === 0 ? (
                  <div className="text-center text-sm text-slate-500">
                    <svg
                      className="mx-auto h-8 w-8 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mt-2">
                      <span className="font-semibold text-slate-700">
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      PDFs, slides, docs, or code snippets
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3 text-sm text-slate-600">
                    {clarifyingFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFileAtIndex(index)}
                          className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        {defaultPreferences && (
          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Lecture preferences
                </h2>
                <p className="max-w-3xl text-sm text-slate-600">
                  {showPreferencesCustomization
                    ? "Customize preferences for this specific lecture."
                    : "Using your default preferences. Click 'Customize' to override for this lecture."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShowPreferencesCustomization(!showPreferencesCustomization)
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                {showPreferencesCustomization ? "Use defaults" : "Customize"}
              </button>
            </div>

            {!showPreferencesCustomization ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      Length:
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">
                      {defaultPreferences.lecture_length.charAt(0).toUpperCase() +
                        defaultPreferences.lecture_length.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Tone:</span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">
                      {defaultPreferences.tone.charAt(0).toUpperCase() +
                        defaultPreferences.tone.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      Questions:
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">
                      {defaultPreferences.enable_questions ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-6">
                  {/* Lecture Length */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-900">
                      Lecture Length
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["short", "medium", "long"] as const).map((length) => {
                        const prefs = customPreferences ?? defaultPreferences;
                        return (
                          <button
                            key={length}
                            type="button"
                            onClick={() =>
                              setCustomPreferences({
                                ...(customPreferences ?? defaultPreferences),
                                lecture_length: length,
                              })
                            }
                            className={`rounded-xl border-2 px-4 py-3 font-medium transition ${
                              prefs.lecture_length === length
                                ? "border-sky-600 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {length.charAt(0).toUpperCase() + length.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-900">
                      Tone
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["direct", "warm", "funny"] as const).map((tone) => {
                        const prefs = customPreferences ?? defaultPreferences;
                        return (
                          <button
                            key={tone}
                            type="button"
                            onClick={() =>
                              setCustomPreferences({
                                ...(customPreferences ?? defaultPreferences),
                                tone,
                              })
                            }
                            className={`rounded-xl border-2 px-4 py-3 font-medium transition ${
                              prefs.tone === tone
                                ? "border-sky-600 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {tone.charAt(0).toUpperCase() + tone.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enable Questions */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-900">
                      Practice Questions
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomPreferences({
                          ...(customPreferences ?? defaultPreferences),
                          enable_questions: !(
                            customPreferences ?? defaultPreferences
                          ).enable_questions,
                        })
                      }
                      className={`flex items-center gap-3 rounded-xl border-2 px-5 py-3 transition ${
                        (customPreferences ?? defaultPreferences)
                          .enable_questions
                          ? "border-sky-600 bg-sky-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                          (customPreferences ?? defaultPreferences)
                            .enable_questions
                            ? "border-sky-600 bg-sky-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {(customPreferences ?? defaultPreferences)
                          .enable_questions && (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium text-slate-900">
                        Enable practice questions
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Instructor follow-ups
              </h2>
              <p className="max-w-3xl text-sm text-slate-600">
                Let Claude spin up targeted clarifying questions so the lecture
                agents can zero in on what matters most.
              </p>
            </div>
            <button
              type="button"
              onClick={generateClarifyingQuestions}
              disabled={
                isGeneratingClarifying || !answers["lecture-topic"]?.trim()
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {isGeneratingClarifying ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  Fetching…
                </>
              ) : (
                "Load clarifying questions"
              )}
            </button>
          </div>

          {clarifyingError ? (
           <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {clarifyingError}
            </div>
          ) : null}
          {isGeneratingClarifying ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
              Summoning instructor follow-ups…
            </div>
          ) : null}

          {!isGeneratingClarifying && clarifyingQuestions?.length ? (
            <div className="grid gap-6">
              {clarifyingQuestions.map((question) => (
                <ClarifyingQuestionCard
                  key={question.question_id}
                  question={question}
                  value={clarifyingAnswers[question.question_id]}
                  onChange={(nextValue) =>
                    setClarifyingAnswers((prev) => ({
                      ...prev,
                      [question.question_id]: nextValue,
                    }))
                  }
                />
              ))}
            </div>
          ) : null}
          {!isGeneratingClarifying &&
          (!clarifyingQuestions || clarifyingQuestions.length === 0) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Generate clarifying questions to give the instructor duo
              additional direction.
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setAnswers(buildInitialAnswers());
              setClarifyingQuestions(null);
              setClarifyingAnswers({});
              setClarifyingError(null);
              setLectureStubId(null);
              setClarifyingFiles([]);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Reset responses
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "Submitting…" : "Submit & generate lecture"}
          </button>
        </div>
      </form>
    </div>
  );
}
