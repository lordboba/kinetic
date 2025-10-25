"use client";

import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
};

let cachedApp: FirebaseApp | undefined;
let cachedAuth: Auth | undefined;

const envConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? undefined,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? undefined,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
};

export function missingFirebaseConfigKeys(): string[] {
  return Object.entries(envConfig)
    .filter(([, value]) => typeof value === "string" && value.trim().length === 0)
    .map(([key]) => key);
}

export function isFirebaseConfigValid(): boolean {
  return missingFirebaseConfigKeys().length === 0;
}

function assertConfig() {
  const missing = missingFirebaseConfigKeys();

  if (missing.length > 0) {
    const details = missing.join(", ");
    throw new Error(
      `Missing Firebase client configuration. Populate NEXT_PUBLIC_FIREBASE_* env vars. Missing: ${details}`,
    );
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }

  assertConfig();

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(envConfig);
  return cachedApp;
}

export function getClientAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getFirebaseApp();
  cachedAuth = getAuth(app);
  return cachedAuth;
}
