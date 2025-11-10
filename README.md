# LectureGen

LectureGen lets learners assemble interactive, multi-modal lectures that match their pace and preferred learning style. The platform pairs an AI "lead instructor" with an attentive "teaching assistant" to scaffold explanations, walkthroughs, and practice in the formats that work best for each person.

## Why LectureGen?

- **Problem**: Traditional lectures and textbooks are one-size-fits-all, favor passive listening, and rarely accommodate neurodiverse learners or people who need multisensory reinforcement.
- **Solution**: Give learners a configurable lecture builder that mixes content blocks (concept overviews, code-first demos, comprehension checks) with presentation styles (visual summaries, audio narration, blended flows).
- **Value**: Higher engagement and retention through adaptive pacing, modality switching, and a "sudo teacher + TA" duo that encourages questions and hands-on practice.

## Core Capabilities

- Assemble lectures interactively with AI-guided clarification questions and personalized scaffolding.
- Render content as audio-first, visual-first, or blended experiences powered by LiveKit's low-latency media stack.
- Generate diagrams, code walkthroughs, and practice prompts on demand using Zod-validated LLM outputs.
- Cache learner uploads and lecture assets for reuse across study sessions.

## System Architecture

```text
frontend/ (Next.js 16 + React 19)
    ↳ Renders the lecture builder UI, handles modality selection, and streams media.
api/ (Fastify + TypeScript)
    ↳ Manages lecture creation, file caching, LiveKit/WebSocket sessions, and Claude integrations.
types/ (shared Zod schemas)
    ↳ Ensures consistent lecture, preference, and user models across services.
LiveKit + Anthropic + Firebase
    ↳ Realtime TTS/STT, LLM orchestration, persistent storage, and asset hosting.
```

## Repository Layout

```text
api/             Fastify service, WebSocket handlers, Claude + LiveKit helpers
app/             (reserved for future agents / orchestration tooling)
frontend/        Next.js application and UI components
types/           Shared Zod schemas compiled to JS/TS for reuse
AGENTS.md        Reference for AI agent behaviors and responsibilities
test-livekit.sh  Smoke test for LiveKit connectivity
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Access to Anthropic Claude, LiveKit, Firebase, and Google Custom Search credentials
- Sponsor integrations (see internal sponsor list) when required for specific lecture experiences

## Setup

1. Install dependencies at the workspace root:
   ```bash
   pnpm install
   ```
2. Create a `.env` file in the repository root (the frontend automatically loads it via `dotenv`).
3. Populate the environment variables listed below. At minimum you will need API keys for Anthropic, LiveKit, Firebase, and Google Custom Search.
4. Optional: add `service-account-key.json` inside `api/` or point `FIREBASE_SERVICE_ACCOUNT_PATH` to a secure location.

## Environment Variables

### Shared (root or frontend)

| Variable | Required | Description |
| --- | --- | --- |
| `BACKEND_ENDPOINT` | yes | Base URL for the Fastify API (e.g. `http://localhost:4000/api/`). |
| `NEXT_PUBLIC_BACKEND_ENDPOINT` | optional | Overrides `BACKEND_ENDPOINT` on the client. Use when exposing a different base URL to browsers. |

### Anthropic / LLM

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Claude API key used for lecture planning, clarifying questions, and diagram synthesis. |

### LiveKit & Media

| Variable | Required | Description |
| --- | --- | --- |
| `LIVEKIT_WEBSOCKET_URL` | yes | LiveKit server URL for realtime WebSocket sessions. |
| `LIVEKIT_API_KEY` | yes | LiveKit API key for authentication. |
| `LIVEKIT_API_SECRET` | yes | LiveKit API secret (alias: `LIVEKIT_API_SECRET_KEY`). |
| `LIVEKIT_DEFAULT_VOICE` | optional | Default TTS voice identifier (falls back to the built-in sample voice). |
| `LIVEKIT_REQUEST_TIMEOUT_MS` | optional | Override for LiveKit request timeout. |
| `LIVEKIT_INFERENCE_URL` | optional | Base URL for LiveKit's inference APIs. |
| `LIVEKIT_INFERENCE_API_KEY` | optional | Inference API key when using LiveKit hosted AI. |
| `LIVEKIT_INFERENCE_API_SECRET` | optional | Inference API secret (alias: `LIVEKIT_INFERENCE_API_SECRET_KEY`). |
| `LIVEKIT_INFERENCE_STT_MODEL` | optional | Default speech-to-text model name. |
| `LIVEKIT_INFERENCE_STT_LANGUAGE` | optional | Default STT locale. |
| `LIVEKIT_INFERENCE_TTS_MODEL` | optional | Default text-to-speech model. |
| `LIVEKIT_INFERENCE_TTS_VOICE` | optional | Default TTS voice override. |

### Firebase & Storage

| Variable | Required | Description |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | required* | Filesystem path to a Firebase service account JSON. Required unless `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` is set. |
| `FIREBASE_SERVICE_ACCOUNT` | optional | Inline JSON string of credentials (mutually exclusive with the path). |
| `FIREBASE_PROJECT_ID` | optional | Overrides Firebase project ID if not inferred from credentials. |
| `FIREBASE_STORAGE_BUCKET` | optional | Overrides default storage bucket. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | Firebase client config for the frontend. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | Firebase auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | Firebase project ID exposed to the client. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | Firebase web app ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | optional | Client-side storage bucket override. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | optional | Messaging sender ID for notifications. |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | optional | Analytics measurement ID. |

### Search & Diagram Helpers

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_CSE_ID` | yes | Google Custom Search engine ID for image lookup. |
| `GOOGLE_API_KEY` | yes | Google API key paired with the CSE. |

### Operational Defaults

| Variable | Required | Description |
| --- | --- | --- |
| `HOST` | optional | Interface the Fastify server binds to (defaults to `0.0.0.0`). |
| `PORT` | optional | Fastify port (defaults to `4000`). |
| `NODE_ENV` | optional | When set to `production`, suppresses verbose logging. |

## Running Locally

- Start the full stack (Next.js + Fastify):
  ```bash
  pnpm dev
  ```
- Run individual services:
  ```bash
  pnpm dev:web   # frontend only
  pnpm dev:api   # backend only
  ```
- Visit `http://localhost:3000` for the LectureGen UI and `http://localhost:4000` for API logs.

## API Surface Snapshot

| Endpoint | Method | Transport | Status |
| --- | --- | --- | --- |
| `/api/create-lecture-initial` | POST | HTTP multipart | Persists lecture stubs, caches uploads, returns `{ success, lecture_id, questions[] }`. |
| `/api/tts` | GET | WebSocket | Streams LiveKit-backed TTS (`tts.result` events). HTTP requests return 426. |
| `/api/lecture` | GET | HTTP / WebSocket | HTTP placeholder (501). WebSocket closes with 1011 (handler pending). |
| `/api/watch_lecture` | GET | WebSocket | Streams lecture snapshots and answers `user_question_request` prompts. HTTP requests return 426. |

## Diagram & Asset Generation

- Web search via Google Images (powered by `GOOGLE_CSE_ID` + `GOOGLE_API_KEY`).
- External agents such as NotesGPT/DiagramGPT for bespoke diagrams.
- On-the-fly Mermaid rendering generated by Claude and rendered in the frontend.

## Accessibility & Personalization

LectureGen emphasizes adaptive pacing, multi-modal outputs (audio, visual, blended), and scaffolding that benefits neurodiverse learners and anyone needing alternatives to passive lectures.

## Development Tips

- All runtime schemas live in `types/` and are shared via `schema` package links—validate new contracts with Zod before integrating.
- Keep functions focused; prefer composing helpers in the agent loop rather than expanding single mega-functions.
- Refer to `AGENTS.md` for the latest guidance on agent behaviors and orchestration patterns.
- Before launching new lecture formats, verify sponsor integration requirements (see the internal sponsor list).

## Troubleshooting

- LiveKit issues: run `./test-livekit.sh` for a quick connectivity check.
- Firebase credentials: ensure `service-account-key.json` exists or set `FIREBASE_SERVICE_ACCOUNT`.
- Missing backend URL: the frontend falls back to `BACKEND_ENDPOINT`; a missing value will throw at startup (`frontend/lib/env.ts`).

## License

Internal project. Do not distribute without approval.

