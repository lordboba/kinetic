"use client";

import { useState } from "react";

type LecturePreferences = {
  lecture_length: "short" | "medium" | "long";
  tone: "direct" | "warm" | "funny";
  enable_questions: boolean;
};

interface PreferencesModalProps {
  isOpen: boolean;
  onComplete: (preferences: LecturePreferences) => void;
  onSkip: () => void;
}

export function PreferencesModal({
  isOpen,
  onComplete,
  onSkip,
}: PreferencesModalProps) {
  const [preferences, setPreferences] = useState<LecturePreferences>({
    lecture_length: "medium",
    tone: "warm",
    enable_questions: true,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
            <svg
              className="h-8 w-8 text-sky-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">
            Welcome to Lecture Gen Studio!
          </h2>
          <p className="mt-3 text-lg text-slate-600">
            Let's customize your lecture preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Lecture Length */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">
              Lecture Length
            </label>
            <p className="mb-3 text-sm text-slate-600">
              Short: 3-5 slides • Medium: 8-10 slides • Long: 12-15 slides
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(["short", "medium", "long"] as const).map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() =>
                    setPreferences({ ...preferences, lecture_length: length })
                  }
                  className={`rounded-xl border-2 px-4 py-3 font-medium transition ${
                    preferences.lecture_length === length
                      ? "border-sky-600 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {length.charAt(0).toUpperCase() + length.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">
              Tone
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["direct", "warm", "funny"] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setPreferences({ ...preferences, tone })}
                  className={`rounded-xl border-2 px-4 py-3 font-medium transition ${
                    preferences.tone === tone
                      ? "border-sky-600 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {tone.charAt(0).toUpperCase() + tone.slice(1)}
                </button>
              ))}
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
                setPreferences({
                  ...preferences,
                  enable_questions: !preferences.enable_questions,
                })
              }
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-5 py-3 transition ${
                preferences.enable_questions
                  ? "border-sky-600 bg-sky-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                  preferences.enable_questions
                    ? "border-sky-600 bg-sky-600"
                    : "border-slate-300 bg-white"
                }`}
              >
                {preferences.enable_questions && (
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
                Include practice questions during lectures
              </span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full px-6 py-3 font-semibold text-slate-600 transition hover:text-slate-900"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => onComplete(preferences)}
            className="rounded-full bg-sky-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-sky-700"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
