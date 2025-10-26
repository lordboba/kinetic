# S6 WebSocket #1 Implementation Status

## Summary: What's Already Built

### ✅ BACKEND - Fully Implemented
The WebSocket handler for S6 is **FULLY IMPLEMENTED** but **NOT CONNECTED** to the router.

**File**: [api/src/routes/create_lecture.ts:214-379](api/src/routes/create_lecture.ts#L214-L379)

**Function**: `create_lecture_main` (WebsocketHandler)

**What it does:**
1. Accepts WebSocket connection with `lecture_id` and `answers` in query params
2. Validates user has access to the lecture (checks ASSET_CACHE)
3. Generates transcript using Claude → Sends status update
4. Enumerates total counts for images, diagrams, and TTS → Sends status updates
5. Concurrently generates all assets:
   - **Mermaid Diagrams** (via Claude) → Sends progress update per diagram
   - **Images** (via Google Images search) → Sends progress update per image
   - **Voiceovers** (via LiveKit Avatar TTS) → Sends progress update per audio
6. Saves complete lecture to Firebase
7. Adds lecture ID to user's lecture array in Firebase
8. Sends "completedAll" status update
9. Closes WebSocket

**Status Messages Sent** (type `CreateLectureStatusUpdate`):
```typescript
// After transcript generation
{ type: "completedOne", completed: "transcript" }

// After counting assets
{ type: "enumerated", thing: "images", total: N }
{ type: "enumerated", thing: "diagrams", total: N }
{ type: "enumerated", thing: "tts", total: N }

// For each image/diagram/audio completed
{ type: "completedOne", completed: "images", counter: N }
{ type: "completedOne", completed: "diagrams", counter: N }
{ type: "completedOne", completed: "tts", counter: N }

// When all complete
{ type: "completedAll" }
```

---

## ❌ CRITICAL GAP: Route Not Registered

### Problem
The `create_lecture_main` WebSocket handler exists but is **NOT registered** in the router.

**File**: [api/src/routes/index.ts:29-34](api/src/routes/index.ts#L29-L34)

Currently, the `/api/lecture` route uses a **stub handler** that just closes the connection:

```typescript
const createLectureStreamHandler = (
  _lectureStore: LectureStore,
): WebsocketHandler => {
  return (socket) => {
    socket.close(1011, "Lecture stream handler not yet connected.");
  };
};
```

### Solution Needed
Replace the stub with `create_lecture_main`:

```typescript
// In api/src/routes/index.ts
import { create_lecture_initial, create_lecture_main } from "./create_lecture.js";

// Then update the route (line 107-113):
app.route({
  method: "GET",
  url: "/api/lecture",
  websocket: true,
  preHandler: verify_firebase_token,  // ADD THIS
  handler: createLectureAssetHandler(lectureStore),
  wsHandler: create_lecture_main,  // CHANGE THIS
});
```

---

## ⚠️ FRONTEND - Partially Implemented

### Current Implementation
**File**: [frontend/app/(app)/lectures/new/progress/page.tsx](frontend/app/(app)/lectures/new/progress/page.tsx)

**What it does:**
1. ✅ Retrieves config from sessionStorage
2. ❌ Calls `/api/newLecture` (endpoint doesn't exist!)
3. ✅ Opens WebSocket to `/api/lecture?id={jobId}`
4. ✅ Listens for WebSocket messages
5. ❌ Doesn't parse or display messages
6. ❌ Doesn't redirect when complete

### Problems

#### Problem 1: Frontend calls non-existent endpoint
**Line 85**: `await fetch("/api/newLecture", {...})`

This endpoint doesn't exist! The backend expects:
- Initial request → `/api/create-lecture-initial` (already working)
- Then WebSocket directly → `/api/lecture?lecture_id={id}&answers={answers}`

#### Problem 2: WebSocket connection format is wrong
**Line 115**: `const socketUrl = ${protocol}://${window.location.host}/api/lecture?id=${jobId}`

Should be:
```typescript
const socketUrl = `${protocol}://${window.location.host}/api/lecture?lecture_id=${lectureId}&answers=${encodeURIComponent(JSON.stringify(answersArray))}`;
```

#### Problem 3: Messages not parsed or displayed
**Line 119-120**: Just logs messages to console
```typescript
socket.onmessage = (event) => console.debug("lecture-progress", event.data);
```

Should parse and update UI:
```typescript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data) as CreateLectureStatusUpdate;

  if (data.type === "completedAll") {
    // Redirect to lecture display
    router.push(`/lectures/${lectureId}`);
  } else if (data.type === "enumerated") {
    // Update total counts
    setTotalCounts(prev => ({ ...prev, [data.thing]: data.total }));
  } else if (data.type === "completedOne") {
    // Update progress counters
    if (data.completed === "transcript") {
      setTranscriptComplete(true);
    } else {
      setProgress(prev => ({ ...prev, [data.completed]: data.counter }));
    }
  }
};
```

---

## 🔧 What You Need to Do for S6

### Backend Changes (5 minutes)

1. **Wire up the WebSocket handler**

   **File**: `api/src/routes/index.ts`

   ```typescript
   // Add import at top
   import { create_lecture_initial, create_lecture_main } from "./create_lecture.js";

   // Update route (around line 107)
   app.route({
     method: "GET",
     url: "/api/lecture",
     websocket: true,
     preHandler: verify_firebase_token,  // ADD authentication
     handler: createLectureAssetHandler(lectureStore),
     wsHandler: create_lecture_main,  // CHANGE from createLectureStreamHandler
   });
   ```

2. **Fix query parameter parsing in create_lecture_main**

   **File**: `api/src/routes/create_lecture.ts` line 215

   The current code expects `answers` in query params, but it should be in the WebSocket message body. You need to:
   - Accept connection first
   - Wait for client to send initial message with answers
   - Then start processing

   OR keep it in query params but make sure frontend sends it correctly.

### Frontend Changes (30 minutes)

1. **Remove the `/api/newLecture` call**

   **File**: `frontend/app/(app)/lectures/new/progress/page.tsx`

   Delete lines 82-111 (the `startLectureJob` fetch call)

2. **Connect WebSocket with correct parameters**

   ```typescript
   const startLectureJob = async () => {
     setStatus("connecting");

     // Build answers array from stored config
     const answersArray = parsedConfig.clarifyingQuestions?.map(q => ({
       question_id: q.question_id,
       answer: parsedConfig.clarifyingAnswers[q.question_id]
     })) ?? [];

     const protocol = window.location.protocol === "https:" ? "wss" : "ws";
     const params = new URLSearchParams({
       lecture_id: parsedConfig.lectureStubId!,
       answers: JSON.stringify(answersArray)
     });
     const socketUrl = `${protocol}://${window.location.host}/api/lecture?${params}`;

     socket = new WebSocket(socketUrl);
     socket.onopen = () => setStatus("connected");
     socket.onmessage = handleMessage;
     socket.onerror = (event) => {
       console.error(event);
       setError("WebSocket connection failed.");
       setStatus("error");
     };
   };
   ```

3. **Add state for progress tracking**

   ```typescript
   const [transcriptComplete, setTranscriptComplete] = useState(false);
   const [totalCounts, setTotalCounts] = useState({ images: 0, diagrams: 0, tts: 0 });
   const [progress, setProgress] = useState({ images: 0, diagrams: 0, tts: 0 });
   ```

4. **Implement message handler**

   ```typescript
   const handleMessage = (event: MessageEvent) => {
     try {
       const data = JSON.parse(event.data) as CreateLectureStatusUpdate;

       switch (data.type) {
         case "completedOne":
           if (data.completed === "transcript") {
             setTranscriptComplete(true);
           } else {
             setProgress(prev => ({ ...prev, [data.completed]: data.counter }));
           }
           break;

         case "enumerated":
           setTotalCounts(prev => ({ ...prev, [data.thing]: data.total }));
           break;

         case "completedAll":
           setStatus("completed");
           router.push(`/lectures/${lectureId}`);
           break;
       }
     } catch (err) {
       console.error("Failed to parse message:", err);
     }
   };
   ```

5. **Update UI to show progress**

   Use the existing `lecture-status-timeline.tsx` component:

   ```tsx
   import { LectureStatusTimeline } from "@/components/lectures/lecture-status-timeline";

   <LectureStatusTimeline
     transcriptComplete={transcriptComplete}
     imageProgress={progress.images}
     imagTotal={totalCounts.images}
     diagramProgress={progress.diagrams}
     diagramTotal={totalCounts.diagrams}
     ttsProgress={progress.tts}
     ttsTotal={totalCounts.tts}
   />
   ```

---

## Authentication Note

The WebSocket needs authentication! Options:

### Option 1: Token in query param (easier)
```typescript
const token = await getIdToken();
const params = new URLSearchParams({
  lecture_id: parsedConfig.lectureStubId!,
  answers: JSON.stringify(answersArray),
  token: token  // Add token to query
});
```

Then update middleware to check query params.

### Option 2: Token in first message (cleaner)
```typescript
socket.onopen = () => {
  const token = await getIdToken();
  socket.send(JSON.stringify({
    type: "auth",
    token,
    lecture_id: parsedConfig.lectureStubId!,
    answers: answersArray
  }));
};
```

Then update `create_lecture_main` to expect this message format.

---

## Data Flow Summary

```
FRONTEND (S5: Clarification Questions)
  │
  ├─ User enters topic + uploads files
  ├─ POST /api/create-lecture-initial
  │   ├─ Returns: lecture_id, questions[]
  │   └─ Stores in ASSET_CACHE on backend
  │
  ├─ User answers questions
  └─ Submit → Navigate to /lectures/new/progress
      └─ Stores config in sessionStorage

FRONTEND (S6: Loading Screen)
  │
  ├─ Read config from sessionStorage
  │   ├─ lecture_id (from S5)
  │   ├─ answers[] (user's responses)
  │   └─ user token (from auth)
  │
  ├─ Open WebSocket to /api/lecture
  │   └─ Query params: lecture_id, answers
  │
  └─ Listen for status updates
      ├─ completedOne: transcript
      ├─ enumerated: images (total: N)
      ├─ enumerated: diagrams (total: N)
      ├─ enumerated: tts (total: N)
      ├─ completedOne: images (counter: 1, 2, 3...)
      ├─ completedOne: diagrams (counter: 1, 2, 3...)
      ├─ completedOne: tts (counter: 1, 2, 3...)
      └─ completedAll → REDIRECT to S7

BACKEND (WebSocket Handler)
  │
  ├─ Validate user + lecture_id
  ├─ Generate transcript (Claude)
  │   └─ Send: { type: "completedOne", completed: "transcript" }
  │
  ├─ Count assets
  │   ├─ Send: { type: "enumerated", thing: "images", total: N }
  │   ├─ Send: { type: "enumerated", thing: "diagrams", total: N }
  │   └─ Send: { type: "enumerated", thing: "tts", total: N }
  │
  ├─ Generate all assets in parallel
  │   ├─ For each image → Send: { type: "completedOne", completed: "images", counter: N }
  │   ├─ For each diagram → Send: { type: "completedOne", completed: "diagrams", counter: N }
  │   └─ For each TTS → Send: { type: "completedOne", completed: "tts", counter: N }
  │
  ├─ Save lecture to Firebase
  ├─ Add to user's lectures array
  │
  └─ Send: { type: "completedAll" }
      └─ Close WebSocket
```

---

## Type Definitions Reference

All types are defined in [types/index.d.ts](types/index.d.ts):

```typescript
type CreateLectureMainRequest = {
  lecture_id: string;
  answers: CreateLectureAnswer[];
};

type CreateLectureAnswer = {
  question_id: Uuid;
  answer: Uuid | string;  // Uuid for radio/checkbox, string for text_input
};

type CreateLectureStatusUpdate =
  | { type: "completedAll" }
  | { type: "completedOne"; completed: "transcript" }
  | { type: "completedOne"; completed: "images" | "tts" | "diagrams"; counter: number }
  | { type: "enumerated"; thing: "images" | "diagrams" | "tts"; total: number };
```

---

## Quick Start Checklist

To get WebSocket #1 working:

- [ ] **Backend**: Import `create_lecture_main` in `api/src/routes/index.ts`
- [ ] **Backend**: Replace stub `wsHandler` with `create_lecture_main`
- [ ] **Backend**: Add `preHandler: verify_firebase_token` to route
- [ ] **Frontend**: Remove `/api/newLecture` POST request
- [ ] **Frontend**: Fix WebSocket URL to include `lecture_id` and `answers`
- [ ] **Frontend**: Add authentication token to WebSocket connection
- [ ] **Frontend**: Implement message handler to parse `CreateLectureStatusUpdate`
- [ ] **Frontend**: Add state variables for progress tracking
- [ ] **Frontend**: Update UI to show progress (use `LectureStatusTimeline` component)
- [ ] **Frontend**: Add redirect to `/lectures/{id}` when `completedAll` received

---

## Testing Plan

1. Start backend: `cd api && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `/lectures/new`
4. Enter topic and generate questions
5. Answer questions and submit
6. Should navigate to `/lectures/new/progress`
7. WebSocket should connect and show real-time progress
8. When complete, should redirect to lecture display page

---

## Next Steps (After S6 Works)

Once WebSocket #1 is working, you'll need to implement:

1. **S7**: Lecture display page with video player
2. **WebSocket #2**: User-initiated questions during lecture
3. **Chat sidebar**: Q&A interface with local storage
4. **Check-in questions**: Backend-initiated questions during lecture

But for now, focus on getting WebSocket #1 connected and displaying progress!
