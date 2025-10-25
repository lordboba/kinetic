/// THIS IS JUST A MODEL ///

type Uuid = string;
type Audio = null;
type Diagram = string; // mermaid
type Image = string; // URLencoded? src?
type FirebaseStub = null;
type FileUpload = {
    file_name: string;
    file_type: "audio" | "image" | "diagram";
    file_path: string;
};

/// DATA ///

type LecturePreferences = {
    // slides:        3-5       8-10      12-15
    lecture_length: "short" | "medium" | "long";
    tone: "direct" | "warm" | "funny";
    enable_questions: boolean;
    reference_youtuber: "3Blue1Brown" | "Crash Course" | "Veritasium";
};

type LectureSlide = {
    transcript: string;
    voiceover: Audio; // mp3 path? raw bytes?
    title: string;
    content?: string; // narrow: bullet points?
    diagram?: Diagram;
    image?: Image;
};

type Lecture = {
    id: Uuid;
    permitted_users: User[]; // identify by: user.id; alternatively, Uuid[]
    slides: LectureSlide[];
};

type User = {
    id: Uuid;
    auth: FirebaseStub | { username: string; password_hash: string };
    user_preferences: LecturePreferences;
    lectures: Lecture[]; // by lecture.id or just uuid[]
};

/// REQUESTS ///

// Let firebase take care of auth bullshit

type CreateLectureInitialRequest = {
    lecture_id: Uuid;
    lecture_topic: string;
    file_uploads: FileUpload[];
};

type QStub<T> = T & { question: string; id: Uuid };
type QOption = { text: string; id: Uuid };
type CreateLectureQuestion = QStub<
    | { question_type: "radio"; options: QOption[] }
    | { question_type: "checkbox"; options: QOption[] }
    | { question_type: "text_input" }
>;

type CreateLectureInitialResponse = {
    questions: CreateLectureQuestion[];
    success: boolean;
    error?: string;
};

type CreateLectureMainRequest = {};

type AskLectureQuestionRequest = {
    lecture_id: Uuid;
    question: string;
};

type AskLectureQuestionResponse = {
    answer: string;
    success: boolean;
    error?: string;
};

