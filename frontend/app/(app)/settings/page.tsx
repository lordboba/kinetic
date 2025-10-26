"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";

type LecturePreferences = {
  lecture_length: "short" | "medium" | "long";
  tone: "direct" | "warm" | "funny";
  enable_questions: boolean;
};

type UserProfile = {
  uid: string;
  email: string;
  displayName?: string;
  preferences: LecturePreferences;
  createdAt: number;
  updatedAt: number;
};

export default function SettingsPage() {
  const { user, loading, getIdToken } = useAuth();
  const router = useRouter();
  const [preferences, setPreferences] = useState<LecturePreferences>({
    lecture_length: "medium",
    tone: "warm",
    enable_questions: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const token = await getIdToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.profile) {
            setPreferences(data.profile.preferences);
          }
        } else if (response.status === 404) {
          // Profile doesn't exist yet, create it with defaults
          const createResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: user.email || "",
                displayName: user.displayName,
                preferences: {
                  lecture_length: "medium",
                  tone: "warm",
                  enable_questions: true,
                },
              }),
            }
          );

          if (createResponse.ok) {
            const data = await createResponse.json();
            if (data.success && data.profile) {
              setPreferences(data.profile.preferences);
            }
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    if (user) {
      loadProfile();
    }
  }, [user, getIdToken]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const token = await getIdToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/preferences`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ preferences }),
        }
      );

      if (response.ok) {
        setSaveMessage({
          type: "success",
          text: "Preferences saved successfully!",
        });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({
          type: "error",
          text: "Failed to save preferences. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to save preferences. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">Settings</h1>
          <p className="mt-3 text-lg text-slate-600">
            Customize your default lecture preferences. These will be used as
            defaults when creating new lectures.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-8">
            {/* Lecture Length */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-900">
                Lecture Length
              </label>
              <p className="mb-4 text-sm text-slate-600">
                Choose the default length for your lectures (short: 3-5 slides,
                medium: 8-10 slides, long: 12-15 slides)
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
              <p className="mb-4 text-sm text-slate-600">
                Select the default tone for lecture content
              </p>
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
              <p className="mb-4 text-sm text-slate-600">
                Include interactive questions during lectures
              </p>
              <button
                type="button"
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    enable_questions: !preferences.enable_questions,
                  })
                }
                className={`flex items-center gap-3 rounded-xl border-2 px-5 py-3 transition ${
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
                  Enable practice questions
                </span>
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-10 flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full bg-sky-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                "Save Preferences"
              )}
            </button>

            {saveMessage && (
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  saveMessage.type === "success"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {saveMessage.type === "success" ? (
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                {saveMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
