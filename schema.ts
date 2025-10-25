import { z } from "zod";

/// PRIMITIVES ///

export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

export const AudioSchema = z.null(); // placeholder for audio data, file path later
export type Audio = z.infer<typeof AudioSchema>;

export const DiagramSchema = z.string(); // mermaid
export type Diagram = z.infer<typeof DiagramSchema>;

export const ImageSchema = z.string(); // URLencoded? src?
export type Image = z.infer<typeof ImageSchema>;

export const FirebaseStubSchema = z.null(); // firebase authentication
export type FirebaseStub = z.infer<typeof FirebaseStubSchema>;

export const FileUploadSchema = z.object({
  file_name: z.string(),
  file_type: z.enum(["audio", "image", "diagram"]),
  file_path: z.string(),
});
export type FileUpload = z.infer<typeof FileUploadSchema>;

/// DATA ///

export const LecturePreferencesSchema = z.object({
  // slides:        3-5       8-10      12-15
  lecture_length: z.enum(["short", "medium", "long"]),
  tone: z.enum(["direct", "warm", "funny"]),
  enable_questions: z.boolean(),
  reference_youtuber: z.enum(["3Blue1Brown", "Crash Course", "Veritasium"]),
});
export type LecturePreferences = z.infer<typeof LecturePreferencesSchema>;

export const LectureSlideSchema = z.object({
  transcript: z.string(),
  voiceover: AudioSchema, // mp3 path? raw bytes?
  title: z.string(),
  content: z.string().optional(), // narrow: bullet points?
  diagram: DiagramSchema.optional(),
  image: ImageSchema.optional(),
});
export type LectureSlide = z.infer<typeof LectureSlideSchema>;

// Forward declaration for recursive User type
export const LectureSchema: z.ZodType<{
  id: string;
  version: number;
  permitted_users: any[]; // Will be User[] after User is defined
  slides: LectureSlide[];
}> = z.object({
  id: UuidSchema,
  version: z.number(), // race condition: account for case where user sends new request before prev finishes
  // share lecture -> ensure only registered users can access
  permitted_users: z.lazy(() => z.array(UserSchema)), // identify by: user.id; alternatively, Uuid[]
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
  lectures: z.array(LectureSchema), // by lecture.id or just uuid[]
});
export type User = z.infer<typeof UserSchema>;

/// REQUESTS ///

export const ResponseErrorSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});
export type ResponseError = z.infer<typeof ResponseErrorSchema>;

// REQUEST HELPERS //
export const QOptionSchema = z.object({
  text: z.string(),
  option_id: UuidSchema,
});
export type QOption = z.infer<typeof QOptionSchema>;

export const CreateLectureQuestionSchema = z.union([
  z.object({
    question_type: z.literal("radio"),
    options: z.array(QOptionSchema),
    question: z.string(),
    question_id: UuidSchema,
  }),
  z.object({
    question_type: z.literal("checkbox"),
    options: z.array(QOptionSchema),
    question: z.string(),
    question_id: UuidSchema,
  }),
  z.object({
    question_type: z.literal("text_input"),
    question: z.string(),
    question_id: UuidSchema,
  }),
]);
export type CreateLectureQuestion = z.infer<typeof CreateLectureQuestionSchema>;

export const CreateLectureAnswerSchema = z.object({
  question_id: UuidSchema,
  question_answer: z.union([
    z.object({
      question_type: z.enum(["radio", "checkbox"]),
      answer: UuidSchema,
    }),
    z.object({
      question_type: z.literal("text_input"),
      answer: z.string(),
    }),
  ]),
});
export type CreateLectureAnswer = z.infer<typeof CreateLectureAnswerSchema>;

// END REQUEST HELPERS //

// Let firebase take care of auth bullshit

// 1. User requests general topic
export const CreateLectureInitialRequestSchema = z.object({
  user_id: UuidSchema,
  lecture_topic: z.string(),
  file_uploads: z.array(FileUploadSchema),
});
export type CreateLectureInitialRequest = z.infer<typeof CreateLectureInitialRequestSchema>;

// 2. Backend responds with question to refine topic
export const CreateLectureInitialResponseSchema = ResponseErrorSchema.extend({
  lecture_id: UuidSchema,
  questions: z.array(CreateLectureQuestionSchema),
});
export type CreateLectureInitialResponse = z.infer<typeof CreateLectureInitialResponseSchema>;

// 3. User requests that create lecture job commences, by providing answers to clarifying questions
export const CreateLectureMainRequestSchema = z.object({
  user_id: UuidSchema,
  lecture_id: UuidSchema,
  answers: z.array(CreateLectureAnswerSchema),
});
export type CreateLectureMainRequest = z.infer<typeof CreateLectureMainRequestSchema>;

// everything below here will be sent over ws //

// 4. Backend responds by opening a web socket (opening a lane)
export const CreateLectureMainResponseSchema = z.object({
  /** status/heartbeat? */
});
export type CreateLectureMainResponse = z.infer<typeof CreateLectureMainResponseSchema>;

// User interrupts lecture to request question (mid-lecture)
export const UserInitiatedQuestionRequestSchema = z.object({
  user_id: UuidSchema,
  lecture_id: UuidSchema,
  lecture_version: z.number(),
  slide: z.number(),
  timestamp: z.number(), // #secs into slide voiceover
  cursor: z.number(), // #words into slide voiceover
  question: z.string(),
});
export type UserInitiatedQuestionRequest = z.infer<typeof UserInitiatedQuestionRequestSchema>;

// Backend responds to question (mid-lecture)
export const BackendQuestionResponseSchema = ResponseErrorSchema.extend({
  answer: z.string(),
  lecture: LectureSchema,
});
export type BackendQuestionResponse = z.infer<typeof BackendQuestionResponseSchema>;

// Backend requests check-in question (mid-lecture)
export const BackendInitiatedQuestionRequestSchema = z.object({
  lecture_id: UuidSchema,
  lecture_version: z.number(),
  slide: z.number(),
  question: z.string(),
});
export type BackendInitiatedQuestionRequest = z.infer<typeof BackendInitiatedQuestionRequestSchema>;

// User responds to check-in question
export const UserQuestionResponseSchema = z.object({
  user_id: UuidSchema,
  answer: z.string(),
  lecture_id: UuidSchema,
});
export type UserQuestionResponse = z.infer<typeof UserQuestionResponseSchema>;
