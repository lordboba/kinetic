import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AppOptions,
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import type { Lecture } from "schema";
import { uploadVoiceoverDataUrl } from "../helpers/storage/voiceovers";

type CliOptions = {
  inputPath: string;
  outputPath: string;
  lectureId: string;
  bucket?: string;
  expiresInDays: number;
};

type UploadSummary = {
  index: number;
  bytes: number;
  storagePath: string;
  url: string;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    throw new Error(
      "Usage: pnpm --filter api tsx src/scripts/upload-voiceovers.ts <input.json> [output.json] [--lecture-id=ID] [--bucket=name] [--expires-in-days=730] [--in-place]"
    );
  }

  const positional: string[] = [];
  let lectureId: string | undefined;
  let bucket: string | undefined;
  let expiresInDays = 730;
  let inPlace = false;

  for (const arg of args) {
    if (arg.startsWith("--lecture-id=")) {
      lectureId = arg.split("=")[1];
      continue;
    }
    if (arg === "--in-place") {
      inPlace = true;
      continue;
    }
    if (arg.startsWith("--bucket=")) {
      bucket = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--expires-in-days=")) {
      const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(value) && value > 0) {
        expiresInDays = value;
      } else {
        throw new Error(
          `Invalid value for --expires-in-days. Expected positive integer, received '${arg}'.`
        );
      }
      continue;
    }
    positional.push(arg);
  }

  const [inputPath, optionalOutput] = positional;
  if (!inputPath) {
    throw new Error("First positional argument must be the lecture JSON path.");
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const derivedLectureId =
    lectureId ??
    path
      .basename(resolvedInput)
      .replace(/-?\d+.*$/, "")
      .replace(/\.json$/i, "");

  const resolvedOutput = inPlace
    ? resolvedInput
    : path.resolve(
        process.cwd(),
        optionalOutput ??
          resolvedInput.replace(/\.json$/i, "-voiceovers-uploaded.json")
      );

  return {
    inputPath: resolvedInput,
    lectureId: derivedLectureId || `lecture-${Date.now()}`,
    outputPath: resolvedOutput,
    bucket,
    expiresInDays,
  };
}

async function initializeFirebase(bucket?: string) {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    path.resolve(process.cwd(), "service-account-key.json");

  let serviceAccount: ServiceAccount | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    ) as ServiceAccount;
  } else {
    try {
      const fileBuffer = await fs.readFile(serviceAccountPath, "utf-8");
      serviceAccount = JSON.parse(fileBuffer) as ServiceAccount;
    } catch (error) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // rely on application default credentials
      } else {
        throw new Error(
          `Failed to load Firebase service account. Set FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS. Original error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    serviceAccount?.project_id ??
    process.env.GCLOUD_PROJECT;

  const storageBucket =
    bucket ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (projectId ? `${projectId}.appspot.com` : undefined);

  if (!storageBucket) {
    throw new Error(
      "Unable to determine storage bucket. Provide --bucket, FIREBASE_STORAGE_BUCKET, or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  const options: AppOptions = {
    projectId,
    storageBucket,
  };

  if (serviceAccount) {
    options.credential = cert(serviceAccount);
  } else {
    options.credential = applicationDefault();
  }

  return initializeApp(options);
}

async function uploadVoiceovers({
  lecture,
  lectureId,
  expiresInDays,
}: {
  lecture: Lecture;
  lectureId: string;
  expiresInDays: number;
}): Promise<UploadSummary[]> {
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const uploads: UploadSummary[] = [];

  for (const [index, slide] of lecture.slides.entries()) {
    const legacyVoiceover = (slide as Record<string, unknown>).voiceover;
    const candidateLink =
      typeof slide.audio_transcription_link === "string"
        ? slide.audio_transcription_link
        : typeof legacyVoiceover === "string"
          ? legacyVoiceover
          : undefined;
    if (typeof candidateLink !== "string" || !candidateLink.startsWith("data:")) {
      continue;
    }
    if (!slide.audio_transcription_link) {
      if (typeof legacyVoiceover === "string") {
        // @ts-expect-error backward compatibility for legacy voiceover field
        delete (slide as Record<string, unknown>).voiceover;
      }
      slide.audio_transcription_link = candidateLink;
    }
    const upload = await uploadVoiceoverDataUrl({
      dataUrl: slide.audio_transcription_link,
      lectureId,
      slideIndex: index,
      expiresAt,
      cacheControl: "public,max-age=31536000,immutable",
    });

    slide.audio_transcription_link = upload.signedUrl;
    uploads.push({
      index,
      bytes: upload.bytes,
      storagePath: upload.storagePath,
      url: upload.signedUrl,
    });
  }

  return uploads;
}

async function main() {
  const options = parseArgs();
  const { inputPath, outputPath, lectureId, bucket, expiresInDays } = options;

  const raw = await fs.readFile(inputPath, "utf-8");
  const lecture = JSON.parse(raw) as Lecture;

  if (!lecture.slides || lecture.slides.length === 0) {
    throw new Error("Lecture JSON must include at least one slide.");
  }

  const app = await initializeFirebase(bucket);
  const bucketName = app.options.storageBucket;

  if (!bucketName) {
    throw new Error("Firebase app is missing a configured storage bucket.");
  }

  const uploads = await uploadVoiceovers({
    lecture,
    lectureId,
    expiresInDays,
  });

  if (uploads.length === 0) {
    console.warn(
      "No data URLs found in slide voiceovers. Output file will be identical to input."
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(lecture, null, 2));

  console.log(`✅ Updated lecture saved to ${outputPath}`);
  if (uploads.length > 0) {
    console.log(
      `🔊 Uploaded ${uploads.length} voiceovers to bucket '${bucketName}' for lecture '${lectureId}'.`
    );
    for (const upload of uploads) {
      console.log(
        `  • Slide ${upload.index + 1}: ${upload.bytes} bytes -> ${upload.storagePath}`
      );
    }
  }
}

main().catch((error) => {
  console.error("❌ upload-voiceovers failed:", error);
  process.exit(1);
});
