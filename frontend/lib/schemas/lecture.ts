import { z } from "zod";

export const lectureProgressSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["pending", "in-progress", "complete"]),
  etaMinutes: z.number().optional(),
});

export const lectureAssetSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  tags: z.array(z.string()),
  durationMinutes: z.number().int().nonnegative(),
  summary: z.string(),
  instructorNote: z.string(),
  coverImage: z.string().optional(),
  formats: z.array(z.string()),
  progress: z.array(lectureProgressSchema),
  practicePrompts: z.array(z.string()),
});

export type LectureAsset = z.infer<typeof lectureAssetSchema>;
