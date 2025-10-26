"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useAuth } from "@/components/auth/auth-provider";
import { getClientAuth } from "@/lib/firebaseClient";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/lectures");
    }
  }, [loading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const auth = getClientAuth();
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.replace("/lectures");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We hit an unexpected error. Double-check your credentials and config.";
      setError(message);
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const auth = getClientAuth();
      await signInWithPopup(auth, provider);
      router.replace("/lectures");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to sign in with Google. Check your Firebase OAuth settings.";
      setError(message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary to-accent">
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary via-primary to-accent">
      <div className="flex w-full max-w-lg flex-col gap-10 px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-5xl font-bold text-white">
            {mode === "login" ? "Welcome Back!" : "Create your learning profile"}
          </h1>
        </div>

        <div className="rounded-3xl border border-primary-200 bg-white p-8 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-primary-200 px-4 py-3 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-primary-200 px-4 py-3 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Keep it secure"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting
              ? "Working on it…"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-slate-900 font-medium">or</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full border-2 border-primary-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-primary-50 active:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue with Google
          </button>
        </div>
      </div>

      <div className="text-center text-sm text-foreground/70">
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="font-semibold text-white underline-offset-4 transition hover:underline hover:text-primary-800"
        >
          {mode === "login"
            ? "Need an account? Create one."
            : "Already have an account? Sign in."}
        </button>
      </div>
      </div>
    </div>
  );
}
