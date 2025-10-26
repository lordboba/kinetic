"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PreferencesModal } from "@/components/onboarding/preferences-modal";

type LecturePreferences = {
  lecture_length: "short" | "medium" | "long";
  tone: "direct" | "warm" | "funny";
  enable_questions: boolean;
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, getIdToken } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Check if user has a profile
  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setCheckingProfile(false);
        return;
      }

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

        if (response.status === 404) {
          // Profile doesn't exist, show onboarding
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error("Error checking profile:", error);
      } finally {
        setCheckingProfile(false);
      }
    }

    if (user && !loading) {
      checkProfile();
    }
  }, [user, loading, getIdToken]);

  const handleOnboardingComplete = async (preferences: LecturePreferences) => {
    if (!user) return;

    try {
      const token = await getIdToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email || "",
          displayName: user.displayName,
          preferences,
        }),
      });

      setShowOnboarding(false);
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  };

  const handleOnboardingSkip = async () => {
    if (!user) return;

    try {
      const token = await getIdToken();
      // Create profile with defaults
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
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
      });

      setShowOnboarding(false);
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  };

  if (loading || !user || checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceHeader />
      <main>{children}</main>
      <PreferencesModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    </div>
  );
}
