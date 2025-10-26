import { randomUUID } from "node:crypto";

import { admin, storageBucketName } from "../../lib/firebase_admin.js";

const DEFAULT_SIGNED_URL_TTL_DAYS = Number.parseInt(
  process.env.FIREBASE_VOICEOVER_URL_TTL_DAYS ?? "365",
  10
);

export const DEFAULT_VOICEOVER_SIGNED_URL_TTL_MS =
  Number.isFinite(DEFAULT_SIGNED_URL_TTL_DAYS) && DEFAULT_SIGNED_URL_TTL_DAYS > 0
    ? DEFAULT_SIGNED_URL_TTL_DAYS * 24 * 60 * 60 * 1000
    : 365 * 24 * 60 * 60 * 1000;

export type VoiceoverUploadResult = {
  signedUrl: string;
  storagePath: string;
  bytes: number;
  expiresAt: Date;
};

export type UploadVoiceoverBufferOptions = {
  lectureId?: string;
  slideIndex?: number;
  buffer: Buffer;
  mimeType: string;
  /**
   * Optional override for the generated filename (without extension).
   * When omitted a deterministic value is derived from slideIndex or a random UUID.
   */
  filenameHint?: string;
  /**
   * Custom metadata to store on the GCS object. Values are coerced to strings.
   */
  customMetadata?: Record<string, string | number | boolean | undefined>;
  /**
   * Explicit expiry for the signed URL. When omitted the helper falls back
   * to expiresInMs or the default TTL.
   */
  expiresAt?: Date;
  /**
   * Millisecond duration used to compute expiry if expiresAt is not provided.
   */
  expiresInMs?: number;
  /**
   * Optional Cache-Control header applied to the stored object.
   */
  cacheControl?: string;
};

export type UploadVoiceoverDataUrlOptions = Omit<
  UploadVoiceoverBufferOptions,
  "buffer" | "mimeType"
> & {
  dataUrl: string;
};

export function determineVoiceoverExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("aac")) return "aac";
  const parts = normalized.split("/");
  if (parts.length === 2 && parts[1]) {
    return parts[1].split(";")[0];
  }
  return "bin";
}

export function parseVoiceoverDataUrl(dataUrl: string):
  | { buffer: Buffer; mimeType: string }
  | null {
  const match = /^data:(.+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;
  try {
    const buffer = Buffer.from(base64Data, "base64");
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9/_-]/g, "-");
}

function buildVoiceoverStoragePath({
  lectureId,
  slideIndex,
  extension,
  filenameHint,
}: {
  lectureId?: string;
  slideIndex?: number;
  extension: string;
  filenameHint?: string;
}) {
  const fallbackBase = filenameHint?.length
    ? sanitizePathSegment(filenameHint)
    : randomUUID();
  const resolvedLectureId =
    typeof lectureId === "string" && lectureId.length > 0
      ? sanitizePathSegment(lectureId)
      : undefined;

  const slideSuffix =
    typeof slideIndex === "number" && Number.isFinite(slideIndex)
      ? `slide-${String(slideIndex + 1).padStart(2, "0")}`
      : fallbackBase;

  if (resolvedLectureId) {
    return `lectures/${resolvedLectureId}/voiceovers/${slideSuffix}.${extension}`;
  }

  return `voiceovers/${slideSuffix}.${extension}`;
}

function coerceCustomMetadata(
  metadata: UploadVoiceoverBufferOptions["customMetadata"]
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value === undefined) {
        return acc;
      }
      acc[key] =
        typeof value === "string" ? value : String(value);
      return acc;
    },
    {}
  );

  return Object.keys(entries).length > 0 ? entries : undefined;
}

export async function uploadVoiceoverBuffer(
  options: UploadVoiceoverBufferOptions
): Promise<VoiceoverUploadResult> {
  const {
    lectureId,
    slideIndex,
    buffer,
    mimeType,
    filenameHint,
    customMetadata,
    expiresAt,
    expiresInMs,
    cacheControl,
  } = options;

  if (!storageBucketName) {
    throw new Error(
      "Firebase storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  const extension = determineVoiceoverExtension(mimeType);
  const storagePath = buildVoiceoverStoragePath({
    lectureId,
    slideIndex,
    extension,
    filenameHint,
  });

  const bucket = admin.storage().bucket(storageBucketName);
  const file = bucket.file(storagePath);

  const customMetadataRecord = coerceCustomMetadata({
    ...customMetadata,
    lectureId,
    slideIndex,
  });

  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      ...(cacheControl ? { cacheControl } : {}),
      ...(customMetadataRecord ? { metadata: customMetadataRecord } : {}),
    },
  });

  const resolvedExpiry =
    expiresAt ??
    new Date(
      Date.now() +
        (Number.isFinite(expiresInMs)
          ? (expiresInMs as number)
          : DEFAULT_VOICEOVER_SIGNED_URL_TTL_MS)
    );

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: resolvedExpiry,
  });

  return {
    signedUrl,
    storagePath,
    bytes: buffer.length,
    expiresAt: resolvedExpiry,
  };
}

export async function uploadVoiceoverDataUrl(
  options: UploadVoiceoverDataUrlOptions
): Promise<VoiceoverUploadResult> {
  const payload = parseVoiceoverDataUrl(options.dataUrl);
  if (!payload) {
    throw new Error("Voiceover data URL is malformed or missing base64 payload.");
  }

  return uploadVoiceoverBuffer({
    lectureId: options.lectureId,
    slideIndex: options.slideIndex,
    buffer: payload.buffer,
    mimeType: payload.mimeType,
    filenameHint: options.filenameHint,
    customMetadata: options.customMetadata,
    expiresAt: options.expiresAt,
    expiresInMs: options.expiresInMs,
    cacheControl: options.cacheControl,
  });
}
