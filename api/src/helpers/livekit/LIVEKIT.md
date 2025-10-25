# LiveKit Usage Cheatsheet

## Text-to-Speech
- Call `generateAvatarSpeech(text, options?)` from `tts.ts`.
- Options accept `voice`, `language`, `model`, plus optional avatar metadata.
- The helper normalizes text, selects defaults, and forwards to LiveKit via `synthesizeAvatarSpeech`.
- Responses include base64 WAV data (`audioUrl`), transcript, duration, and latency metrics.

## Convert to WAV
- Use `saveAvatarSpeechResponseAsWav(response, opts?)` from `convert-audio.ts`.
- It validates the LiveKit data URL, decodes the WAV payload, and writes it to disk.
- Pass `outputDir` and `fileBaseName` to control target location and name; defaults land in `@test-outputs`.
- The function returns the raw `Buffer`, byte length, duration, and latency for further processing.

## CLI Helpers
- `tsx tts.ts "Hello world"` → prints the response and logs JSON under `@test-outputs/`.
- `tsx convert-audio.ts @test-outputs/livekit-tts-*.json` → batch-converts logged JSON files to `.wav`.
