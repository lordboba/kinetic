import { z } from "zod";

/// TYPE DEFINITIONS ///

export const UuidSchema = z.string().uuid();
export const AudioSchema = z.null();
export const DiagramSchema = z.string();
export const ImageSchema = z.string();
export const FirebaseStubSchema = z.null();

export type Uuid = z.infer<typeof UuidSchema>;
export type Audio = z.infer<typeof AudioSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type FirebaseStub = z.infer<typeof FirebaseStubSchema>;

/// FILE UPLOAD SCHEMA ///

export const FileUploadSchema = z.object({
  file_name: z.string(),
  file_type: z.enum(["audio", "image", "diagram"]),
  file_path: z.string(),
});

export type FileUpload = z.infer<typeof FileUploadSchema>;

/// DATA SCHEMAS ///

export const LecturePreferencesSchema = z.object({
  lecture_length: z.enum(["short", "medium", "long"]),
  tone: z.enum(["direct", "warm", "funny"]),
  enable_questions: z.boolean(),
  reference_youtuber: z.enum(["3Blue1Brown", "Crash Course", "Veritasium"]),
});

export type LecturePreferences = z.infer<typeof LecturePreferencesSchema>;

export const LectureSlideSchema = z.object({
  transcript: z.string(),
  voiceover: AudioSchema,
  title: z.string(),
  content: z.string().optional(),
  diagram: DiagramSchema.optional(),
  image: ImageSchema.optional(),
});

export type LectureSlide = z.infer<typeof LectureSlideSchema>;

export const LectureSchema = z.object({
  id: UuidSchema,
  permitted_users: z.lazy(() => z.array(UserSchema)),
  slides: z.array(LectureSlideSchema),
});

export type Lecture = z.infer<typeof LectureSchema>;

export const UserSchema = z.object({
  id: UuidSchema,
  auth: z.union([
    FirebaseStubSchema,
    z.object({
      username: z.string(),
      password_hash: z.string(),
    }),
  ]),
  user_preferences: LecturePreferencesSchema,
  lectures: z.lazy(() => z.array(LectureSchema)),
});

export type User = z.infer<typeof UserSchema>;

/// REQUEST/RESPONSE SCHEMAS ///

export const CreateLectureInitialRequestSchema = z.object({
  lecture_topic: z.string(),
  file_uploads: z.array(FileUploadSchema),
});

export type CreateLectureInitialRequest = z.infer<
  typeof CreateLectureInitialRequestSchema
>;

export const QOptionSchema = z.object({
  text: z.string(),
  id: UuidSchema,
});

export type QOption = z.infer<typeof QOptionSchema>;

export const CreateLectureQuestionSchema = z.discriminatedUnion("question_type", [
  z.object({
    question_type: z.literal("radio"),
    question: z.string(),
    id: UuidSchema,
    options: z.array(QOptionSchema),
  }),
  z.object({
    question_type: z.literal("checkbox"),
    question: z.string(),
    id: UuidSchema,
    options: z.array(QOptionSchema),
  }),
  z.object({
    question_type: z.literal("text_input"),
    question: z.string(),
    id: UuidSchema,
  }),
]);

export type CreateLectureQuestion = z.infer<typeof CreateLectureQuestionSchema>;

export const CreateLectureInitialResponseSchema = z.object({
  questions: z.array(CreateLectureQuestionSchema),
  success: z.boolean(),
  error: z.string().optional(),
});

export type CreateLectureInitialResponse = z.infer<
  typeof CreateLectureInitialResponseSchema
>;

export const CreateLectureMainRequestSchema = z.object({});

export type CreateLectureMainRequest = z.infer<
  typeof CreateLectureMainRequestSchema
>;

/// SCHEMA NAMESPACE ///

export const Schema = {
  uuid: UuidSchema,
  audio: AudioSchema,
  diagram: DiagramSchema,
  image: ImageSchema,
  firebaseStub: FirebaseStubSchema,
  fileUpload: FileUploadSchema,
  lecturePreferences: LecturePreferencesSchema,
  lectureSlide: LectureSlideSchema,
  lecture: LectureSchema,
  user: UserSchema,
  createLectureInitialRequest: CreateLectureInitialRequestSchema,
  qOption: QOptionSchema,
  createLectureQuestion: CreateLectureQuestionSchema,
  createLectureInitialResponse: CreateLectureInitialResponseSchema,
  createLectureMainRequest: CreateLectureMainRequestSchema,
};
