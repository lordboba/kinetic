import { z } from "zod";

type FileUpload = {
  name: string;
  content: string;
};

/// DATA ///

type LecturePreferences = {
  // slides:        3-5       8-10      12-15
  lecture_length: "short" | "medium" | "long";
  tone: "direct" | "warm" | "funny";
  enable_questions: boolean;
  //   reference_youtuber: "3Blue1Brown" | "Crash Course" | "Veritasium";
};

export const ZLectureSlide = z.object({
  transcript: z.string(),
  audio_transcription_link: z.string().optional(), // signed download URL
  title: z.string(),
  content: z.string().optional(),
  diagram: z.string().optional(),
  image: z.string().optional(),
  question: z.string().optional(),
});

export const ZLecture = z.object({
  version: z.number(),
  topic: z.string(),
  permitted_users: z.array(z.string()),
  slides: z.array(ZLectureSlide),
});

export const ZGetLectureRequest = z.object({
  type: z.literal("get_lecture_request"),
  lecture_id: z.string(),
  capabilities: z
    .object({
      audio_streaming: z.boolean().optional(),
    })
    .optional(),
});

export const ZGetLectureResponse = z.object({
  type: z.literal("get_lecture_response"),
  lecture: ZLecture,
});

export const ZUserQuestionRequest = z.object({
  type: z.literal("user_question_request"),
  lecture_id: z.string(),
  current_slide: z.number(),
  question: z.string(),
});

export const ZUserAnalyzeQuery = z.discriminatedUnion("answer_category", [
  z.object({
    answer_category: z.literal("simple"),
    response: z.string(),
  }),
  z.object({
    answer_category: z.literal("regenerate_slides"),
    response: z.string(),
    instructions: z.string(),
  }),
]);

export const ZPartialLecture = z.object({
  from_slide: z.number(),
  slides: z.array(ZLectureSlide),
});

export const ZUserQuestionResponse = z.object({
  type: z.literal("user_question_response"),
  response: ZUserAnalyzeQuery,
  partial_lecture: ZPartialLecture.optional(),
});

export const ZSlideAudioChunk = z.object({
  type: z.literal("slide_audio_chunk"),
  lecture_id: z.string(),
  slide_index: z.number(),
  chunk_index: z.number(),
  sample_rate: z.number().positive(),
  channels: z.number().positive(),
  samples_per_channel: z.number().positive(),
  pcm16_base64: z.string(),
  transcript_delta: z.string().optional(),
  is_final: z.boolean().optional(),
});

export const ZSlideAudioStatus = z.object({
  type: z.literal("slide_audio_status"),
  lecture_id: z.string(),
  slide_index: z.number(),
  status: z.enum(["started", "completed", "error"]),
  audio_url: z.string().optional(),
  error: z.string().optional(),
});

export const ZSlideAudioBuffer = z.object({
  type: z.literal("slide_audio_buffer"),
  lecture_id: z.string(),
  slide_index: z.number(),
  chunk_index: z.number(),
  buffered_ms: z.number().nonnegative(),
  ready_to_advance: z.boolean().optional(),
  is_complete: z.boolean().optional(),
});

export const ZBackendQuestionRequest = z.object({
  type: z.literal("backend_question_request"),
  lecture_id: z.string(),
  current_slide: z.number(),
  question: z.string(),
  answer: z.string(),
});

export const ZBackendQuestionResponse = z.object({
  type: z.literal("backend_question_response"),
  feedback: z.string(),
});

export const ZInboundMessage = z.union([
  ZGetLectureRequest,
  ZUserQuestionRequest,
  ZBackendQuestionRequest,
]);

export const ZOutboundMessage = z.union([
  ZGetLectureResponse,
  ZUserQuestionResponse,
  ZBackendQuestionResponse,
  ZSlideAudioChunk,
  ZSlideAudioBuffer,
  ZSlideAudioStatus,
]);

// Inferred TypeScript types (optional)
export type LectureSlide = z.infer<typeof ZLectureSlide>;
export type Lecture = z.infer<typeof ZLecture>;
export type GetLectureRequest = z.infer<typeof ZGetLectureRequest>;
export type GetLectureResponse = z.infer<typeof ZGetLectureResponse>;
export type UserQuestionRequest = z.infer<typeof ZUserQuestionRequest>;
export type UserQuestionResponse = z.infer<typeof ZUserQuestionResponse>;
export type BackendQuestionRequest = z.infer<typeof ZBackendQuestionRequest>;
export type BackendQuestionResponse = z.infer<typeof ZBackendQuestionResponse>;
export type SlideAudioChunk = z.infer<typeof ZSlideAudioChunk>;
export type SlideAudioBuffer = z.infer<typeof ZSlideAudioBuffer>;
export type SlideAudioStatus = z.infer<typeof ZSlideAudioStatus>;
export type InboundMessage = z.infer<typeof ZInboundMessage>;
export type OutboundMessage = z.infer<typeof ZOutboundMessage>;
export type PartialSlide = Omit<
  LectureSlide,
  "transcript" | "audio_transcription_link"
>;
export type PartialLecture = z.infer<typeof ZPartialLecture>;

type User = {
  lectures: string[]; // by lecture.id or just uuid[]
  uid: string;
  email: string;
  displayName?: string;
  preferences: LecturePreferences;
  createdAt: number;
  updatedAt: number;
};

/// REQUESTS ///

type ResponseError = { success: boolean; error?: string };

// REQUEST HELPERS //
type QOption = { text: string; option_id: string };
// diff types of questions
type QStub<T> = T & { question: string; question_id: string };
export type CreateLectureQuestion = QStub<
  | { question_type: "radio"; options: QOption[] }
  | { question_type: "checkbox"; options: QOption[] }
  | { question_type: "text_input" }
>;

export type CreateLectureAnswer = {
  question_id: Uuid;
  // both radio & checkbox have answer ID, text input is open-ended text
  answer: Uuid | string; // lol
};

// END REQUEST HELPERS //

// Let firebase take care of auth bullshit

// 1. User requests general topic
type CreateLectureInitialRequest = {
  user_id: Uuid;
  lecture_topic: string;
  file_uploads: FileUpload[];
  custom_preferences: LecturePreferences;
};

// 2. Backend responds with question to refine topic
type CreateLectureInitialResponse = {
  lecture_id: Uuid;
  questions: CreateLectureQuestion[];
} & ResponseError;

// 3. User requests that create lecture job commences, by providing answers to clarifying questions
type CreateLectureMainRequest = {
  lecture_id: string;
  answers: CreateLectureAnswer[];
  augment_slides_instructions?: string;
  supports_streaming_audio?: string | boolean;
};

// everything below here will be sent over ws //

// 4. Backend responds by opeing a web socket (opening a lane)
type CreateLectureMainResponse = {
  // service will update client when a request finishes
  /** status/heartbeat? */
};

type CreateLectureStatusUpdate =
  | {
      type: "completedAll";
    }
  | {
      // sent once
      type: "completedOne";
      // "transcript" includes slide transcript, title, md content
      completed: "transcript";
    }
  | {
      // sent continuously
      type: "completedOne";
      completed: "images" | "diagrams" | "tts";
      counter: number;
    }
  | {
      // returns total number
      type: "enumerated";
      thing: "images" | "diagrams" | "tts";
      total: number;
    };

// User interrupts lecture to request question (mid-lecture)
// type UserInitiatedQuestionRequest = {
//   user_id: Uuid;
//   lecture_id: Uuid;
//   lecture_version: number;
//   slide: number;
//   question: string;
// };
//
