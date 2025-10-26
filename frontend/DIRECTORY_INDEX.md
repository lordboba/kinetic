# Frontend Directory Structure Index

Complete index of the LectureGen frontend architecture, directory structure, and file-to-screen mappings.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Directory Structure](#directory-structure)
3. [Route Groups & Layouts](#route-groups--layouts)
4. [Page-to-Screen Mapping](#page-to-screen-mapping)
5. [Component Architecture](#component-architecture)
6. [Library Utilities](#library-utilities)
7. [Public Assets](#public-assets)

---

## Technology Stack

**Framework:** Next.js 16.0.0 (App Router)
**React:** 19.2.0
**Styling:** Tailwind CSS 4
**Auth:** Firebase 12.4.0
**Markdown:** react-markdown, remark-gfm, rehype-raw, rehype-sanitize
**Diagrams:** Mermaid 11.12.0
**Validation:** Zod 4.1.12
**Types:** Shared types package (linked from `../types`)

---

## Directory Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── (marketing)/              # Marketing layout group (public)
│   │   ├── layout.tsx            # Marketing layout wrapper
│   │   ├── page.tsx              # Landing page (/)
│   │   └── lectures/
│   │       ├── page.tsx          # Lectures list (unused/deprecated?)
│   │       └── [id]/
│   │           └── page.tsx      # Individual lecture view
│   ├── (app)/                    # Authenticated app layout group
│   │   ├── layout.tsx            # App layout with workspace header
│   │   ├── dashboard/
│   │   │   └── page.tsx          # User dashboard (/dashboard)
│   │   ├── lectures/
│   │   │   └── new/
│   │   │       ├── page.tsx      # Lecture creation questions
│   │   │       └── progress/
│   │   │           └── page.tsx  # Lecture generation progress
│   │   ├── settings/
│   │   │   └── page.tsx          # User settings/preferences
│   │   └── mdx/
│   │       └── page.tsx          # MDX viewer with WebSocket (main lecture player)
│   ├── login/
│   │   └── page.tsx              # Login/register page
│   ├── present/
│   │   ├── layout.tsx            # Presentation mode layout
│   │   └── page.tsx              # Fullscreen presentation mode
│   └── layout.tsx                # Root layout
│
├── components/                   # React components
│   ├── auth/
│   │   ├── auth-provider.tsx     # Firebase auth context provider
│   │   └── protected-content.tsx # Auth guard component
│   ├── layout/
│   │   ├── conditional-layout.tsx # Layout switcher
│   │   ├── site-footer.tsx       # Marketing footer
│   │   ├── site-header.tsx       # Marketing header
│   │   └── workspace-header.tsx  # App header with settings/logout
│   ├── lectures/
│   │   ├── lecture-card.tsx      # Dashboard lecture card
│   │   ├── lecture-detail.tsx    # Lecture detail component
│   │   └── lecture-status-timeline.tsx # Progress tracking
│   ├── onboarding/
│   │   └── preferences-modal.tsx # Preferences modal/form
│   └── slides/
│       └── Slide.tsx             # Individual slide renderer (Markdown + Mermaid)
│
├── lib/                          # Utility libraries
│   ├── data/
│   │   └── mockLectures.ts       # Mock lecture data
│   ├── schemas/
│   │   └── lecture.ts            # Zod schemas for lectures
│   ├── env.ts                    # Environment variable helpers
│   ├── firebaseClient.ts         # Firebase client initialization
│   └── logger.ts                 # Logging utilities
│
├── mdx/                          # MDX content/documentation
│   └── README.md                 # MDX documentation
│
├── public/                       # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .gitignore
├── eslint.config.mjs
├── globals.d.ts                  # Global TypeScript declarations
├── next-env.d.ts                 # Next.js TypeScript definitions
├── next.config.ts                # Next.js configuration
├── package.json
├── postcss.config.mjs            # PostCSS configuration
├── README.md
├── SCREEN_STRUCTURE.md           # Screen-to-file mapping (UI flows)
└── tsconfig.json                 # TypeScript configuration
```

---

## Route Groups & Layouts

Next.js App Router uses route groups (folders in parentheses) to organize pages without affecting URLs.

### 1. Marketing Layout Group `(marketing)/`

**Purpose:** Public-facing pages with marketing header/footer
**Layout:** `app/(marketing)/layout.tsx`
**Pages:**
- `/` - Landing page
- `/lectures/[id]` - Public lecture view (if shared)

**Features:**
- Site header with login/signup
- Site footer
- No authentication required

---

### 2. App Layout Group `(app)/`

**Purpose:** Authenticated application pages
**Layout:** `app/(app)/layout.tsx`
**Pages:**
- `/dashboard` - User dashboard
- `/lectures/new` - Create lecture (clarifying questions)
- `/lectures/new/progress` - Lecture generation progress
- `/settings` - User preferences
- `/mdx` - Main lecture player/viewer

**Features:**
- Workspace header (settings, logout)
- Authentication required
- Protected content

---

### 3. Standalone Routes

**`/login`** - Login/registration page (no special layout)
**`/present`** - Fullscreen presentation mode (minimal layout)

---

## Page-to-Screen Mapping

Detailed mapping of screens to their corresponding files and purposes.

### S1: Landing Page

**Route:** `/`
**File:** `app/(marketing)/page.tsx`
**Layout:** Marketing layout
**Purpose:** Public landing page with product info

**Features:**
- Product name and hero section
- Login button (top right) → `/login`
- "Get started" button → `/dashboard` (or `/login` if not authenticated)
- Features section
- Use cases section

**Navigation:**
- "Sign in" → `/login`
- "Get started" → `/dashboard` (requires auth)

---

### S4: Dashboard

**Route:** `/dashboard`
**File:** `app/(app)/dashboard/page.tsx`
**Layout:** App layout
**Purpose:** User's main workspace with lecture history

**Features:**
- Settings button (gear icon) → `/settings`
- Logout button (workspace header)
- "Hello, [username]!" greeting
- Topic input and file attachment
- "Create New Project" button → `/lectures/new`
- Lecture history cards
- Click lecture card → `/mdx?id={lectureId}` (main viewer)

**Navigation:**
- Settings → `/settings`
- Logout → `/` (landing)
- Create lecture → `/lectures/new`
- View lecture → `/mdx?id={id}`

---

### S5: Lecture Clarification Questions

**Route:** `/lectures/new`
**File:** `app/(app)/lectures/new/page.tsx`
**Layout:** App layout
**Purpose:** Collect clarifying questions before generating lecture

**Features:**
- Topic input field
- File upload (paperclip icon)
- LLM-generated clarification questions
- Question types: radio, checkbox, text input
- Submit button → `/lectures/new/progress`

**API Integration:**
- `POST /api/create-lecture-initial` - Submit topic and get questions
- Stores answers for next step

**Navigation:**
- Submit → `/lectures/new/progress?config={key}`

---

### S6: Loading Screen

**Route:** `/lectures/new/progress`
**File:** `app/(app)/lectures/new/progress/page.tsx`
**Layout:** App layout
**Purpose:** Real-time progress tracking during lecture generation

**Features:**
- WebSocket connection to `/api/lecture`
- Loading spinner
- Status updates:
  - Transcript generation
  - Diagram generation (counter)
  - Image fetching (counter)
  - TTS/audio generation (counter)
- `LectureStatusTimeline` component

**WebSocket Messages:**
- `{ type: "completedOne", completed: "transcript" }`
- `{ type: "enumerated", thing: "images", total: N }`
- `{ type: "completedOne", completed: "images", counter: N }`
- `{ type: "completedAll" }`

**Navigation:**
- Auto-redirect on completion → `/mdx?id={lectureId}`

---

### S7: Lecture Player (MDX Viewer)

**Route:** `/mdx?id={lectureId}` (formerly `/lectures/[id]`)
**File:** `app/(app)/mdx/page.tsx`
**Layout:** App layout
**Purpose:** Interactive lecture viewing with slides, audio, and Q&A

**Features:**
- WebSocket connection to `/api/watch_lecture`
- Slide viewer with markdown rendering
- Audio playback controls
- Slide navigation (keyboard + buttons)
- Question input field
- Real-time Q&A responses
- "Open Presentation Mode" button → Opens `/present?id={id}` in new window
- Connection status indicator
- Answer/feedback display panel

**WebSocket Flow:**
1. Connect to `/api/watch_lecture`
2. Send `{ type: "get_lecture_request", lecture_id: "..." }`
3. Receive `{ type: "get_lecture_response", lecture: {...} }`
4. User asks question → `{ type: "user_question_request", ... }`
5. Receive `{ type: "user_question_response", response: {...} }`

**Keyboard Controls:**
- `←` / `→` - Previous/next slide
- `↑` / `↓` - Previous/next slide

**Components Used:**
- `Slide` component (renders markdown + mermaid + images)
- Custom WebSocket hook (`useLectureChannel`)

**Navigation:**
- Back → `/dashboard`
- Open presentation → `/present?id={id}` (new window)

---

### S7b: Presentation Mode

**Route:** `/present?id={lectureId}`
**File:** `app/present/page.tsx`
**Layout:** Minimal presentation layout
**Purpose:** Fullscreen presentation mode with chat sidebar

**Features:**
- Fullscreen slide display
- Minimal navigation controls
- Right sidebar (200px) for chat (placeholder)
- Keyboard navigation
- Exit button

**Keyboard Controls:**
- `←` / `→` / `Space` - Navigate slides
- `Home` / `End` - First/last slide
- `ESC` - Exit presentation

**Note:** Currently uses test slides, needs to be connected to lecture data.

---

### S8: Login Page

**Route:** `/login`
**File:** `app/login/page.tsx`
**Layout:** None (standalone)
**Purpose:** User authentication

**Features:**
- Email/password login form
- "Sign in with Google" button
- Toggle between login/register modes
- Firebase authentication
- Redirect to `/dashboard` after login

**Navigation:**
- Successful login → `/dashboard`
- From landing page → `/login`

---

### Settings Page

**Route:** `/settings`
**File:** `app/(app)/settings/page.tsx`
**Layout:** App layout
**Purpose:** User preferences management

**Features:**
- Lecture length selector (short/medium/long)
- Tone selector (direct/warm/funny)
- Enable questions toggle
- Save preferences button

**API Integration:**
- `PUT /api/users/profile/preferences` - Update preferences

**Navigation:**
- Back → `/dashboard`

---

## Component Architecture

### Auth Components

#### `auth-provider.tsx`
**Location:** `components/auth/auth-provider.tsx`
**Purpose:** Firebase authentication context provider
**Exports:** `AuthProvider`, `useAuth` hook
**Usage:** Wraps entire app to provide auth state

#### `protected-content.tsx`
**Location:** `components/auth/protected-content.tsx`
**Purpose:** Component guard for authenticated routes
**Usage:** Wraps content that requires authentication

---

### Layout Components

#### `site-header.tsx`
**Location:** `components/layout/site-header.tsx`
**Purpose:** Marketing site header with navigation
**Features:** Logo, login button, navigation links

#### `site-footer.tsx`
**Location:** `components/layout/site-footer.tsx`
**Purpose:** Marketing site footer
**Features:** Links, copyright, social media

#### `workspace-header.tsx`
**Location:** `components/layout/workspace-header.tsx`
**Purpose:** Authenticated app header
**Features:** Settings button, user menu, logout

#### `conditional-layout.tsx`
**Location:** `components/layout/conditional-layout.tsx`
**Purpose:** Switches between marketing and app layouts
**Usage:** Conditionally renders layouts based on route

---

### Lecture Components

#### `lecture-card.tsx`
**Location:** `components/lectures/lecture-card.tsx`
**Purpose:** Displays lecture summary on dashboard
**Props:** Lecture ID, title, date, thumbnail
**Usage:** Dashboard lecture grid

#### `lecture-detail.tsx`
**Location:** `components/lectures/lecture-detail.tsx`
**Purpose:** Detailed lecture information view
**Props:** Full lecture object
**Usage:** Lecture detail pages

#### `lecture-status-timeline.tsx`
**Location:** `components/lectures/lecture-status-timeline.tsx`
**Purpose:** Visual timeline for lecture generation progress
**Props:** Progress array with status for each phase
**Usage:** Loading screen (`/lectures/new/progress`)

---

### Slide Component

#### `Slide.tsx`
**Location:** `components/slides/Slide.tsx`
**Purpose:** Renders individual lecture slides with markdown, mermaid, and images
**Props:**
- `lectureSlides: PartialSlide[]` - Array of slides
- `i: number` - Current slide index

**Features:**
- Markdown rendering with `react-markdown`
- Mermaid diagram support
- Image display
- Automatic H1 → H2 downgrading
- HTML sanitization
- GitHub-flavored markdown (GFM)

**Dependencies:**
- `react-markdown`
- `remark-gfm`
- `rehype-raw`
- `rehype-sanitize`
- `mermaid`

**Slide Data Structure:**
```typescript
interface PartialSlide {
  title: string;
  content?: string;      // Markdown content
  diagram?: string;      // Mermaid diagram code
  image?: string;        // Image URL
}
```

---

### Onboarding Components

#### `preferences-modal.tsx`
**Location:** `components/onboarding/preferences-modal.tsx`
**Purpose:** Modal for setting lecture preferences
**Props:** onSave callback
**Usage:** Onboarding flow, settings page

---

## Library Utilities

### `firebaseClient.ts`

**Location:** `lib/firebaseClient.ts`
**Purpose:** Firebase client initialization and configuration

**Exports:**
- `getFirebaseApp(): FirebaseApp` - Get or initialize Firebase app
- `getClientAuth(): Auth` - Get Firebase auth instance
- `isFirebaseConfigValid(): boolean` - Check if config is complete
- `missingFirebaseConfigKeys(): string[]` - List missing env vars

**Environment Variables Required:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (optional)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

---

### `env.ts`

**Location:** `lib/env.ts`
**Purpose:** Environment variable helpers

**Exports:**
- `getBackendEndpoint(): string` - Get API endpoint URL
- Other environment utilities

---

### `logger.ts`

**Location:** `lib/logger.ts`
**Purpose:** Logging utilities for debugging

---

### `schemas/lecture.ts`

**Location:** `lib/schemas/lecture.ts`
**Purpose:** Zod validation schemas for frontend lecture data

**Schemas:**
- `lectureProgressSchema` - Progress item validation
  ```typescript
  {
    key: string,
    label: string,
    status: "pending" | "in-progress" | "complete",
    etaMinutes?: number
  }
  ```
- `lectureAssetSchema` - Lecture asset validation
  ```typescript
  {
    id: string,
    title: string,
    tagline: string,
    tags: string[],
    durationMinutes: number,
    summary: string,
    instructorNote: string,
    coverImage?: string,
    formats: string[],
    progress: LectureProgress[],
    practicePrompts: string[]
  }
  ```

**Types:**
- `LectureAsset` - Inferred from schema

---

### `data/mockLectures.ts`

**Location:** `lib/data/mockLectures.ts`
**Purpose:** Mock lecture data for testing and development

---

## Public Assets

**Location:** `public/`

Static SVG assets used throughout the app:
- `file.svg` - File icon
- `globe.svg` - Globe/web icon
- `next.svg` - Next.js logo
- `vercel.svg` - Vercel logo
- `window.svg` - Window/browser icon

---

## WebSocket Integration

### Main Lecture Player (`/mdx`)

**Hook:** `useLectureChannel(lectureId: string)`
**File:** `app/(app)/mdx/page.tsx` (lines 31-190)

**States:**
- `disconnected` - Not connected
- `connecting` - WebSocket connecting
- `awaiting_lecture` - Waiting for lecture data
- `ready` - Connected and ready for interaction

**Messages:**
```typescript
// Inbound (Client → Server)
{
  type: "get_lecture_request",
  lecture_id: string
}

{
  type: "user_question_request",
  lecture_id: string,
  current_slide: number,
  question: string
}

// Outbound (Server → Client)
{
  type: "get_lecture_response",
  lecture: Lecture
}

{
  type: "user_question_response",
  response: {
    answer_category: "simple" | "regenerate_slides",
    response: string,
    instructions?: string
  }
}
```

---

### Lecture Generation (`/lectures/new/progress`)

**WebSocket Endpoint:** `/api/lecture`
**File:** `app/(app)/lectures/new/progress/page.tsx`

**Query Parameters:**
- `lecture_id` - Lecture stub ID
- `answers` - Clarifying question answers
- `augment_slides_instructions` - Optional custom instructions

**Status Updates:**
```typescript
{
  type: "completedOne",
  completed: "transcript"
}

{
  type: "enumerated",
  thing: "images" | "diagrams" | "tts",
  total: number
}

{
  type: "completedOne",
  completed: "images" | "diagrams" | "tts",
  counter: number
}

{
  type: "completedAll"
}
```

---

## File Relationships

### How Pages Connect

```
Landing (/)
  ↓ Login
Login (/login)
  ↓ Authenticate
Dashboard (/dashboard)
  ↓ Create new
Questions (/lectures/new)
  ↓ Submit answers
Progress (/lectures/new/progress)
  ↓ Auto-redirect on complete
Viewer (/mdx?id=...)
  ↓ Open presentation
Present (/present?id=...)
```

### Component Dependencies

```
Root Layout
├── Marketing Layout (/)
│   ├── site-header
│   ├── page content
│   └── site-footer
│
└── App Layout (/dashboard, /lectures/*, /settings, /mdx)
    ├── workspace-header
    │   ├── settings button → /settings
    │   └── logout button
    ├── protected-content
    │   └── page content
    │       ├── lecture-card (dashboard)
    │       ├── lecture-status-timeline (progress)
    │       └── Slide (mdx, present)
    └── auth-provider (wraps all)
```

---

## Next Steps / Missing Pieces

Based on `SCREEN_STRUCTURE.md`, the following are planned but not yet implemented:

### To Create
- [ ] `app/(auth)/onboarding/page.tsx` - S2 (Account Setup)
- [ ] `app/(auth)/onboarding/preferences/page.tsx` - S3 (Preferences)
- [ ] `app/(auth)/layout.tsx` - Onboarding layout
- [ ] `components/onboarding/onboarding-stepper.tsx` - Progress indicator
- [ ] `components/lectures/chat-sidebar.tsx` - Chat for viewer
- [ ] `components/lectures/video-player.tsx` - Video player component
- [ ] `components/lectures/chat-message.tsx` - Individual chat messages

### To Enhance
- [ ] Add logout button to workspace header
- [ ] Connect `/present` to actual lecture data (currently uses test slides)
- [ ] Implement chat functionality in presentation mode
- [ ] Add GIF/demo section to landing page
- [ ] Password reset flow
- [ ] Email verification

---

## Summary

The LectureGen frontend is a **Next.js 16 App Router** application with:

- **3 route groups**: `(marketing)`, `(app)`, and standalone routes
- **8 main screens**: Landing, Login, Dashboard, Questions, Progress, Viewer, Presentation, Settings
- **11 components** across auth, layout, lectures, onboarding, and slides
- **Firebase authentication** with protected routes
- **WebSocket integration** for real-time lecture generation and Q&A
- **Markdown + Mermaid rendering** for rich lecture content
- **Shared type package** (`schema`) linked from `../types`

All screens follow a clear user flow from landing → auth → lecture creation → viewing → presentation.
