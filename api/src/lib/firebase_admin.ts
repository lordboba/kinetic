// backend/firebaseAdmin.ts
import admin from "firebase-admin";
import {
  CollectionReference,
  DocumentReference,
  Firestore,
  getFirestore,
} from "firebase-admin/firestore";
// import type { Bucket } from "@google-cloud/storage";
import fs from "node:fs";
import path from "node:path";
import { Lecture, LecturePreferences, User } from "schema";

// Lazy initialization state
let initialized = false;
let db: Firestore;
let resolvedStorageBucket: string | undefined;

function initializeFirebaseAdmin() {
  if (initialized) return;

  let serviceAccount: admin.ServiceAccount | undefined;

  // Try to load from environment variable first (recommended for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
      console.log("[firebase-admin] Loaded service account from FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
    } catch (error) {
      console.error(
        "[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // Fall back to file if environment variable not set
  if (!serviceAccount) {
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
      path.resolve(process.cwd(), "service-account-key.json");

    try {
      const file = fs.readFileSync(serviceAccountPath, "utf-8");
      serviceAccount = JSON.parse(file) as admin.ServiceAccount;
      console.log(`[firebase-admin] Loaded service account from file: ${serviceAccountPath}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[firebase-admin] Failed to load service account JSON from file:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const resolvedProjectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    serviceAccount?.projectId;

  resolvedStorageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (resolvedProjectId ? `${resolvedProjectId}.appspot.com` : undefined);

  if (!admin.apps.length) {
    if (!serviceAccount) {
      throw new Error(
        "Firebase admin service account is missing. Set FIREBASE_SERVICE_ACCOUNT_JSON env var or provide service-account-key.json file."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: resolvedProjectId,
      storageBucket: resolvedStorageBucket,
    });
  }

  db = getFirestore();
  initialized = true;
}

function getDB(): Firestore {
  if (!initialized) {
    initializeFirebaseAdmin();
  }
  return db;
}

function typedCollection<T>(path: string): CollectionReference<T> {
  return getDB().collection(path) as CollectionReference<T>;
}

function typedDoc<T>(path: string): DocumentReference<T> {
  return getDB().doc(path) as DocumentReference<T>;
}

// Specific helpers
export const lecturesCollection = typedCollection<Lecture>("lectures");
export function lectureDoc(id: string) {
  return typedDoc<Lecture>(`lectures/${id}`);
}

export async function create_lecture_stub(
  user_uid: string,
  preferences?: LecturePreferences
) {
  // Get a new doc ref with an auto-generated ID, but don't write anything yet
  const ref = db.collection("lectures").doc();

  // Optional: write a tiny stub so you can also have auditability / security rules
  await ref.set({
    ownerUid: user_uid,
    status: "pending",
    createdAt: Date.now(),
    preferences, // TEMPSTORAGE FOR PREFERENCES
  });

  return ref.id; // <-- this is the unique ID
}

export async function create_lecture_entry(lecture: Lecture) {
  // TypeScript enforces `lecture` matches the Lecture type here.
  await lecturesCollection.add(lecture);
}

// User profile helpers
export const userProfilesCollection = typedCollection<User>("user_profiles");
export function userProfileDoc(uid: string) {
  return typedDoc<User>(`user_profiles/${uid}`);
}

export async function get_user_profile(uid: string): Promise<User | null> {
  const docSnap = await userProfileDoc(uid).get();
  if (!docSnap.exists) {
    return null;
  }
  return docSnap.data() ?? null;
}

export async function create_user_profile(
  uid: string,
  email: string,
  displayName?: string,
  preferences?: LecturePreferences
): Promise<User> {
  const defaultPreferences: LecturePreferences = preferences ?? {
    lecture_length: "medium",
    tone: "warm",
    enable_questions: true,
  };

  const now = Date.now();
  const userProfile: User = {
    uid,
    email,
    displayName,
    preferences: defaultPreferences,
    createdAt: now,
    updatedAt: now,
    lectures: [],
  };

  await userProfileDoc(uid).set(userProfile);
  return userProfile;
}

export async function update_user_preferences(
  uid: string,
  preferences: LecturePreferences
): Promise<void> {
  await userProfileDoc(uid).update({
    preferences,
    updatedAt: Date.now(),
  });
}

export { admin };
export { getDB as db };
export const storageBucketName = resolvedStorageBucket;
export function getDefaultStorageBucket(): any {
  return admin.storage().bucket(resolvedStorageBucket);
}
