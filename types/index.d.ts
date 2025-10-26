/// THIS IS JUST A MODEL ///

type Uuid = string;
type Audio = null; // placeholder for audio data, file path later
type Diagram = string; // mermaid
type Image = string; // URLencoded? src?
type FirebaseStub = null; // firebase authentication
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

type LectureSlide = {
  transcript: string;
  voiceover: string; // download URL; refers to audio in firebase/storage
  title: string;
  content?: string; // narrow: bullet points?
  diagram?: Diagram;
  image?: string; // url
};

type PartialSlide = Omit<LectureSlide,"transcript" | "voiceover">

type Lecture = {
  version: number; // race condition: account for case where user sends new request before prev finishes
  // share lecture -> ensure only registered users can access
  permitted_users: string[]; // identify by: user.id
  slides: LectureSlide[];
};

type User = {
  user_id: Uuid;
  auth: FirebaseStub | { username: string; password_hash: string };
  user_preferences: LecturePreferences;
  lectures: Lecture[]; // by lecture.id or just uuid[]
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
  user_id: Uuid;
  lecture_id: Uuid;
  answers: CreateLectureAnswer[];
};

// everything below here will be sent over ws //

// 4. Backend responds by opeing a web socket (opening a lane)
type CreateLectureMainResponse = {
  // service will update client when a request finishes
  /** status/heartbeat? */
};

// User interrupts lecture to request question (mid-lecture)
type UserInitiatedQuestionRequest = {
  user_id: Uuid;
  lecture_id: Uuid;
  lecture_version: number;
  timestamp: number; // # secs into slide voicover
  slide: number;
  cursor: number; // # words into slide voiceover
  question: string;
};

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
};

// User responds to check-in question
type UserQuestionResponse = {
  user_id: Uuid;
  answer: string;
  lecture_id: Uuid;
};

type LectureMessage = Omit<Lecture, "allowed_users">;
