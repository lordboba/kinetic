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
        console.log("[DEBUG] Checking user profile...");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("[DEBUG] Profile check response status:", response.status);

        if (response.status === 404) {
          // Profile doesn't exist, show onboarding
          console.log("[DEBUG] No profile found (404) - showing onboarding modal");
          setShowOnboarding(true);
        } else if (response.ok) {
          const profileData = await response.json();
          console.log("[DEBUG] Profile found successfully:", profileData);
        } else {
          console.log("[DEBUG] Unexpected response status:", response.status);
        }
      } catch (error) {
        console.error("[DEBUG] Error checking profile:", error);
      } finally {
        setCheckingProfile(false);
      }
    }

    if (user && !loading) {
      checkProfile();
    }
  }, [user, loading, getIdToken]);

  const handleOnboardingComplete = async (preferences: LecturePreferences) => {
    if (!user) {
      console.error("[DEBUG] No user found - cannot create profile");
      return;
    }

    try {
      const token = await getIdToken();
      console.log("[DEBUG] Creating profile with preferences:", preferences);
      console.log("[DEBUG] User email:", user.email);
      console.log("[DEBUG] User displayName:", user.displayName);
      console.log("[DEBUG] API URL:", process.env.NEXT_PUBLIC_API_URL);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email || "",
          displayName: user.displayName || "",
          preferences,
        }),
      });

      console.log("[DEBUG] Profile creation response status:", response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log("[DEBUG] Profile created successfully:", responseData);
        setShowOnboarding(false);
      } else {
        const errorText = await response.text();
        console.error("[DEBUG] Failed to create profile:", response.status, errorText);
        // Close modal anyway to prevent it from being stuck
        alert(`Failed to save profile: ${errorText}. Please try again from settings.`);
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error("[DEBUG] Error creating profile:", error);
      // Close modal anyway to prevent it from being stuck
      alert("An error occurred while saving your profile. Please try again from settings.");
      setShowOnboarding(false);
    }
  };

  const handleOnboardingSkip = async () => {
    if (!user) {
      console.error("[DEBUG] No user found - cannot skip onboarding");
      return;
    }

    try {
      const token = await getIdToken();
      console.log("[DEBUG] Skipping onboarding - creating profile with defaults");
      console.log("[DEBUG] User email:", user.email);
      console.log("[DEBUG] User displayName:", user.displayName);

      // Create profile with defaults
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
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

      console.log("[DEBUG] Skip profile creation response status:", response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log("[DEBUG] Profile created successfully (skip):", responseData);
        setShowOnboarding(false);
      } else {
        const errorText = await response.text();
        console.error("[DEBUG] Failed to create profile (skip):", response.status, errorText);
        // Close modal anyway to prevent it from being stuck
        alert(`Failed to save profile: ${errorText}. Please try again from settings.`);
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error("[DEBUG] Error creating profile (skip):", error);
      // Close modal anyway to prevent it from being stuck
      alert("An error occurred while saving your profile. Please try again from settings.");
      setShowOnboarding(false);
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
