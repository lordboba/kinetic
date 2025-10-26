// backend/firebaseAdmin.ts
import admin from "firebase-admin";
import {
  CollectionReference,
  DocumentReference,
  Firestore,
  getFirestore,
} from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { Lecture, LecturePreferences } from "schema";

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.resolve(process.cwd(), "service-account-key.json");

let serviceAccount: admin.ServiceAccount | undefined;

try {
  const file = fs.readFileSync(serviceAccountPath, "utf-8");
  serviceAccount = JSON.parse(file) as admin.ServiceAccount;
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn(
    "[firebase-admin] Failed to load service account JSON:",
    error instanceof Error ? error.message : error,
  );
}

if (!admin.apps.length) {
  if (!serviceAccount) {
    throw new Error(
      "Firebase admin service account is missing. Provide service-account-key.json or set FIREBASE_SERVICE_ACCOUNT_PATH.",
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = getFirestore();

function typedCollection<T>(path: string): CollectionReference<T> {
  return db.collection(path) as CollectionReference<T>;
}

function typedDoc<T>(path: string): DocumentReference<T> {
  return db.doc(path) as DocumentReference<T>;
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

export { admin, db };
