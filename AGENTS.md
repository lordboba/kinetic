# Lecture Gen Agent Overview

## Core Idea
Lecture Gen enables rapid creation of personalized, high-engagement lecture formats that adapt to each learner's preferred modality and pacing.

## Value Proposition
- Transform static lectures/textbooks into interactive, multimodal learning experiences.
- Provide a configurable "sudo teacher + TA" pairing that scaffolds comprehension and practice.
- Increase accessibility and retention through personalized delivery (visual, audio, and blended formats).

## Problem We Address
Traditional lectures and textbooks are often passive, one-size-fits-all experiences that fail to keep learners engaged, especially when learners need more interactive or multisensory input.

## Our Solution
We let learners assemble their own lecture format by mixing content blocks (explanations, walkthroughs, practice prompts) and presentation styles (audio narration, visual summaries, code-first demos, etc.), guided by AI agents that emulate a lead instructor plus an attentive teaching assistant.

## Primary Use Cases
- Students supplementing or replacing classroom lectures with tailored study materials.
- Professionals upskilling on new topics with concise, interactive refreshers.
- Lifelong learners exploring topics for fun with visual or audio-first learning paths.

## Tools & Integrations
- Sponsor integrations: _Check sponsor list!!!_
- LiveKit powers realtime text-to-speech and speech-to-text for lecture narration and interactive Q&A.

## Tech Stack
- `Next.js` front-end with `pnpm` for fast monorepo-style dependency management.
- `Fastify` HTTP server providing lecture creation and asset retrieval APIs.
- LiveKit media infrastructure for low-latency audio capture, synthesis, and streaming.

### API Surface
- `POST /api/newLecture { topic } → { id }` creates a lecture job and returns its identifier.
- `WS /api/lecture?id={id}` streams progress updates (`transcript complete`, `slides complete`, `diagrams complete`, `voiceover complete`) as each asset becomes available. This is the same input used to interrupt and ask questions during the lecture.
- `GET /api/lecture?id={id}&asset={transcript|slide|voiceover|diagram}` fetches generated lecture artifacts once marked complete.

### Diagram Generation Strategies
- Web search via Google Images for illustrative references.
- External NotesGPT/DiagramGPT calls to synthesize bespoke diagrams.
- On-the-fly Mermaid rendering driven by an LLM for structured visuals.

## Accessibility Impact
Personalized pacing, modality options, and adaptive scaffolding help learners with different needs—including neurodiverse learners and those with limited access to traditional instruction—stay engaged and absorb material more effectively.

## Conventions
- **Type Schemas**: We use [Zod](https://zod.dev/) for runtime type validation and schema definition.
- Structured outputs should be used for LLM inputs and outputs.
- Core logic should be a synthesis of a main thread loop that chains the results of many functions together.
- For code cleanliness purposes, do not write functions that are way too long.
