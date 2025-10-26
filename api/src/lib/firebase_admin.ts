// backend/firebaseAdmin.ts
import admin from "firebase-admin";
import {
  CollectionReference,
  DocumentReference,
  Firestore,
  getFirestore,
} from "firebase-admin/firestore";
import { Lecture, LecturePreferences } from "schema";

const serviceAccount = {};

if (!admin.apps.length) {
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
