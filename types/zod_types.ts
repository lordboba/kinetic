import * as z from "zod";

export const LectureConfigSchema = z.object({
  lecture_topic: z.string().min(1, "lecture_topic cannot be empty"),
});

export const LecturePreferencesSchema = z.object({
  lecture_length: z.enum(["short", "medium", "long"]),
  tone: z.enum(["direct", "warm", "funny"]),
  enable_questions: z.boolean(),
});

export const UploadedFileSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  file: z.any(),
});

export const CreateLectureUploadSchema = z.object({
  lecture_config: LectureConfigSchema,
  lecture_preferences: LecturePreferencesSchema.optional(),
  files: z.array(UploadedFileSchema).optional(),
});

// create a zod type out of
// // REQUEST HELPERS //
// type QOption = { text: string; option_id: Uuid };
// // diff types of questions
// type QStub<T> = T & { question: string; question_id: Uuid };
// export type CreateLectureQuestion = QStub<
//   | { question_type: "radio"; options: QOption[] }
//   | { question_type: "checkbox"; options: QOption[] }
//   | { question_type: "text_input" }
// >;
// export ZCreateLectureQuestion
