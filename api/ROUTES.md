# API Routes & Zod Types Index

This document provides a comprehensive index of all API routes and their corresponding Zod validation schemas.

---

## Routes Overview

| Endpoint | Method | Type | Auth Required | Handler File |
|----------|--------|------|---------------|--------------|
| `/api/create-lecture-initial` | POST | HTTP | Yes | `create_lecture.ts:39` |
| `/api/lecture` | GET | WebSocket | Yes | `create_lecture.ts:221` |
| `/api/watch_lecture` | GET | WebSocket | Yes | `watch_lecture.ts:27` |
| `/api/users/profile` | GET | HTTP | Yes | `user_profile.ts:21` |
| `/api/users/profile/preferences` | PUT | HTTP | Yes | `user_profile.ts:56` |
| `/api/users/profile` | POST | HTTP | Yes | `user_profile.ts:94` |
| `/api/tts` | GET | WebSocket | No | `tts-websocket.ts:35` |
| `/api/get_lectures` | GET | HTTP | Yes | `get_lectures.ts:11` |

---

## Detailed Route Specifications

### 1. Create Lecture (Initial)

**Endpoint:** `POST /api/create-lecture-initial`
**File:** `api/src/routes/create_lecture.ts:39`
**Handler:** `create_lecture_initial`
**Auth:** `verify_firebase_token` (required)

**Request Schema:**
- **Zod:** `CreateLectureUploadSchema` (`api/src/schemas/create-lecture.ts:19`)
  ```typescript
  {
    lecture_config: {
      lecture_topic: string (min 1)
    },
    lecture_preferences?: {
      lecture_length: "short" | "medium" | "long",
      tone: "direct" | "warm" | "funny",
      enable_questions: boolean
    },
    files?: Array<{
      filename: string,
      mimetype: string,
      file: any
    }>
  }
  ```

**Response Type:**
- **Type:** `CreateLectureInitialResponse` (`types/index.d.ts:153`)
  ```typescript
  {
    lecture_id: string,
    questions: CreateLectureQuestion[],
    success: boolean,
    error?: string
  }
  ```

**Notes:**
- Supports both multipart/form-data and JSON requests
- Uses saved user preferences if `lecture_preferences` not provided
- Generates clarifying questions for lecture creation
- Caches file uploads and preferences for subsequent WebSocket connection

---

### 2. Create Lecture (Main WebSocket)

**Endpoint:** `GET /api/lecture` (WebSocket)
**File:** `api/src/routes/create_lecture.ts:221`
**Handler:** `create_lecture_main` (WebSocket)
**Auth:** `verify_firebase_token` (required)

**Request (Query Params):**
- **Type:** `CreateLectureMainRequest` (`types/index.d.ts:159`)
  ```typescript
  {
    lecture_id: string,
    answers: CreateLectureAnswer[],
    augment_slides_instructions?: string
  }
  ```
  - Optional: `supports_streaming_audio=1` to opt into low-latency narration streaming. When omitted, the server waits for every voiceover before signaling completion (legacy behavior).

**WebSocket Messages (Outbound):**
- **Type:** `CreateLectureStatusUpdate` (`types/index.d.ts:173`)
  ```typescript
| { type: "completedAll" }
| { type: "completedOne", completed: "transcript" }
| { type: "completedOne", completed: "images" | "diagrams" | "tts", counter: number }
| { type: "enumerated", thing: "images" | "diagrams" | "tts", total: number }
  ```

**Process Flow:**
1. Validates lecture_id from cache (must match from initial request)
2. Generates transcript with slides
3. Sends enumeration of visual assets (images, diagrams, and—when legacy mode is used—TTS)
4. Generates visual assets in parallel (15 concurrent image limit)
5. If the request includes `supports_streaming_audio=1` the server immediately streams narration via `/api/watch_lecture` while TTS jobs continue in the background; otherwise it waits for every voiceover before replying (legacy behavior)
5. Saves complete lecture to Firestore
6. Updates user profile with lecture ID
7. Sends completion message and closes connection

**Error Responses:**
```typescript
{
  success: false,
  error: string
}
```

---

### 3. Watch Lecture (WebSocket)

**Endpoint:** `GET /api/watch_lecture` (WebSocket)
**File:** `api/src/routes/watch_lecture.ts:27`
**Handler:** `watch_lecture` (WebSocket)
**Auth:** `verify_firebase_token` (required)

**Session States:**
- `waitingForInit` - Must send `get_lecture_request` first
- `ready` - Can send user/backend question requests

**Inbound Messages:**
- **Zod:** `ZInboundMessage` (`types/zod_types.ts:87` & `types/index.d.ts:82`)
  ```typescript
  | ZGetLectureRequest: {
      type: "get_lecture_request",
      lecture_id: string,
      capabilities?: {
        audio_streaming?: boolean
      }
    }
  | ZUserQuestionRequest: {
      type: "user_question_request",
      lecture_id: string,
      current_slide: number,
      question: string
    }
  | ZBackendQuestionRequest: {
      type: "backend_question_request",
      lecture_id: string,
      current_slide: number,
      question: string,
      answer: string
    }
  ```
  - Set `capabilities.audio_streaming = true` to opt into live audio streaming. Legacy clients can omit it to wait for uploaded voiceovers.

**Outbound Messages:**
- **Zod:** `ZOutboundMessage` (`types/zod_types.ts:93` & `types/index.d.ts:88`)
  ```typescript
  | ZGetLectureResponse: {
      type: "get_lecture_response",
      lecture: Lecture
    }
  | ZUserQuestionResponse: {
      type: "user_question_response",
      response: {
        answer_category: "simple",
        response: string
      } | {
        answer_category: "regenerate_slides",
        response: string,
        instructions: string
      }
    }
  | ZBackendQuestionResponse: {
      type: "backend_question_response",
      feedback: string
    }
  ```

**Error Responses:**
```typescript
{
  success: false,
  error: "lecture_not_found" | "invalid_lecture_data" | "already_initialized",
  lecture_id?: string,
  details?: any
}
| { type: "error", error: string }
```

---

### 4. Get User Profile

**Endpoint:** `GET /api/users/profile`
**File:** `api/src/routes/user_profile.ts:21`
**Handler:** `get_profile_handler`
**Auth:** `verify_firebase_token` (required)

**Request:** None (user ID from auth token)

**Response:**
```typescript
{
  success: boolean,
  profile?: {
    lectures: string[],
    uid: string,
    email: string,
    displayName?: string,
    preferences: LecturePreferences,
    createdAt: number,
    updatedAt: number
  },
  error?: string
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (no user ID)
- `404` - Profile not found
- `500` - Server error

---

### 5. Update User Preferences

**Endpoint:** `PUT /api/users/profile/preferences`
**File:** `api/src/routes/user_profile.ts:56`
**Handler:** `update_preferences_handler`
**Auth:** `verify_firebase_token` (required)

**Request Schema:**
- **Zod:** `UpdatePreferencesSchema` (`api/src/routes/user_profile.ts:10`)
  ```typescript
  {
    preferences: {
      lecture_length: "short" | "medium" | "long",
      tone: "direct" | "warm" | "funny",
      enable_questions: boolean
    }
  }
  ```

**Response:**
```typescript
{
  success: boolean,
  message?: string,
  error?: string,
  details?: any
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request body
- `401` - Unauthorized
- `500` - Server error

---

### 6. Create User Profile

**Endpoint:** `POST /api/users/profile`
**File:** `api/src/routes/user_profile.ts:94`
**Handler:** `create_profile_handler`
**Auth:** `verify_firebase_token` (required)

**Request Schema:**
- **Zod:** `CreateProfileSchema` (`api/src/routes/user_profile.ts:14`)
  ```typescript
  {
    email: string (email format),
    displayName?: string,
    preferences?: {
      lecture_length: "short" | "medium" | "long",
      tone: "direct" | "warm" | "funny",
      enable_questions: boolean
    }
  }
  ```

**Response:**
```typescript
{
  success: boolean,
  profile?: User,
  error?: string,
  details?: any
}
```

**Status Codes:**
- `201` - Profile created
- `400` - Invalid request body
- `401` - Unauthorized
- `409` - Profile already exists
- `500` - Server error

---

### 7. Text-to-Speech (WebSocket)

**Endpoint:** `GET /api/tts` (WebSocket)
**File:** `api/src/routes/tts-websocket.ts:35`
**Handler:** `createTtsWebsocketHandler` (WebSocket)
**Auth:** None

**Initial Message (from server):**
```typescript
{ type: "ready" }
```

**Request Schema:**
- **Zod:** `TtsRequestSchema` (`api/src/routes/tts-websocket.ts:7`)
  ```typescript
  {
    type?: "synthesize",
    text: string (min 1),
    voice?: string,
    language?: string,
    model?: string
  }
  ```

**Response Messages:**
```typescript
| {
    type: "tts.result",
    requestId: string,
    audioUrl: string | null,
    durationSeconds: number | null,
    approximateLatencyMs: number | null,
    transcript: string | null
  }
| {
    type: "tts.error",
    message: string
  }
```

**Notes:**
- Only one synthesis request can be processed at a time
- Server sends "ready" message on connection
- Returns audio as data URL or external URL

---

### 8. Get Lectures

**Endpoint:** `GET /api/get_lectures`
**File:** `api/src/routes/get_lectures.ts:11`
**Handler:** `get_lectures`
**Auth:** `verify_firebase_token` (required)

**Request:** None (user ID from auth token)

**Response:**
```typescript
{
  success: boolean,
  lectures: Array<{
    lecture_id: string,
    lecture_topic: string
  }>
}
```

**Notes:**
- Returns all lectures associated with the authenticated user
- Fetches lecture IDs from user profile, then fetches lecture topics from Firestore

---

## Shared Zod Types

### Core Lecture Types

**Location:** `types/index.d.ts` (linked as "schema" package in `api/package.json`)

#### LectureSlide
**Zod:** `ZLectureSlide` (`types/index.d.ts:18`)
```typescript
{
  transcript: string,
  audio_transcription_link: string,  // signed download URL
  title: string,
  content?: string,          // markdown body
  diagram?: string,          // mermaid diagram code
  image?: string,            // image URL
  question?: string          // optional quiz question
}
```

#### Lecture
**Zod:** `ZLecture` (`types/index.d.ts:28`)
```typescript
{
  version: number,
  topic: string,
  permitted_users: string[],
  slides: LectureSlide[]
}
```

#### LecturePreferences
**Zod:** `LecturePreferencesSchema` (`api/src/schemas/create-lecture.ts:7`)
```typescript
{
  lecture_length: "short" | "medium" | "long",  // 3-5, 8-10, 12-15 slides
  tone: "direct" | "warm" | "funny",
  enable_questions: boolean
}
```

#### CreateLectureQuestion
**Type:** `CreateLectureQuestion` (`types/index.d.ts:128`)
```typescript
{
  question: string,
  question_id: string
} & (
  | { question_type: "radio", options: QOption[] }
  | { question_type: "checkbox", options: QOption[] }
  | { question_type: "text_input" }
)

// Where QOption = { text: string, option_id: string }
```

#### CreateLectureAnswer
**Type:** `CreateLectureAnswer` (`types/index.d.ts:134`)
```typescript
{
  question_id: string,
  answer: string  // option_id for radio/checkbox, text for text_input
}
```

---

## Schema File Locations

### API Schemas
- **`api/src/schemas/create-lecture.ts`** - Lecture creation and preference schemas
  - `LectureConfigSchema`
  - `LecturePreferencesSchema`
  - `UploadedFileSchema`
  - `CreateLectureUploadSchema`

### Shared Types Package (`schema` → `../types`)
- **`types/index.d.ts`** - TypeScript type definitions
  - Core lecture types (`Lecture`, `LectureSlide`, `User`)
  - Request/response types
  - WebSocket message types
- **`types/zod_types.ts`** - Zod validation schemas
  - WebSocket message schemas (`ZInboundMessage`, `ZOutboundMessage`)
  - Lecture schemas (duplicated with index.d.ts for runtime validation)

### Route-Specific Schemas
- **`api/src/routes/user_profile.ts`**
  - `UpdatePreferencesSchema` (line 10)
  - `CreateProfileSchema` (line 14)
- **`api/src/routes/tts-websocket.ts`**
  - `TtsRequestSchema` (line 7)

---

## Authentication

All routes except `/api/tts` use `verify_firebase_token` middleware which:
- Validates Firebase ID token from `Authorization: Bearer <token>` header
- Attaches decoded user info to `req.user`
- Returns 401 if token is invalid or missing

**User object structure:**
```typescript
{
  uid: string,
  email?: string,
  // ... other Firebase token claims
}
```

---

## WebSocket Upgrade Handling

Routes that support WebSocket connections (`/api/lecture`, `/api/watch_lecture`, `/api/tts`) use a dual handler pattern:

1. **HTTP Handler** - Returns 426 (Upgrade Required) for non-WebSocket requests
2. **WebSocket Handler** - Processes WebSocket connections

**Example HTTP error response:**
```typescript
{
  error: "upgrade_required",
  message: "Connect to this endpoint via WebSocket..."
}
```

---

## Notes

- The `schema` package in `api/package.json` is a symlink to `../types`
- Zod schemas exist in both `types/index.d.ts` and `types/zod_types.ts` (some duplication)
- All WebSocket routes validate messages with Zod before processing
- Image generation has a concurrency limit of 15 streams
- Voiceover data URLs are persisted to Cloud Storage when possible
- Debug snapshots are written to `.debug/firestore/` during lecture creation
