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
  audio_transcription_link: z.string(), // signed download URL
  title: z.string(),
  content: z.string().optional(),
  diagram: z.string().optional(),
  image: z.string().optional(),
  question: z.string().optional(),
});

export const ZLecture = z.object({
  version: z.number(),
  permitted_users: z.array(z.string()),
  slides: z.array(ZLectureSlide),
});

// Inferred TypeScript types (optional)
export type LectureSlide = z.infer<typeof ZLectureSlide>;
export type Lecture = z.infer<typeof ZLecture>;
export type PartialSlide = Omit<LectureSlide, "transcript" | "audio_transcription_link">;

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
type QOption = { text: string; option_id: Uuid };
// diff types of questions
type QStub<T> = T & { question: string; question_id: Uuid };
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
      completed: "images" | "tts" | "diagrams";
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

// 2 diff lecture responses
// Case 1: no need for additional slides, too big of question prompt to start new lecture
// Case 2: only requires a few slide diff -> text + lecture
// Backend responds to question (mid-lecture)
type BackendQuestionResponse = (
  | { answer: string; lecture: Lecture }
  | { answer: string }
) &
  ResponseError;

// Backend requests check-in question (mid-lecture)
// Take into account diff users access same lecture
type BackendInitiatedQuestionRequest = {
  lecture_id: Uuid;
  lecture_version: number;
  slide: number;
  question: string;
  user_answer: string;
};

// User responds to check-in question
type UserQuestionResponse = {
  user_id: Uuid;
  answer: string;
  lecture_id: Uuid;
};

type LectureMessage = Omit<Lecture, "allowed_users">;
