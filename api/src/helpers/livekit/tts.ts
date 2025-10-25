import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { SynthesizeAvatarSpeechResponse } from './tts-avatar.js';
import { AvatarStyleOptionsSchema, SynthesizeAvatarSpeechResponseSchema, synthesizeAvatarSpeech } from './tts-avatar.js';

export const GenerateAvatarSpeechOptionsSchema = z.object({
  voice: z.string().optional(),
  format: z.enum(['mp3', 'wav', 'ogg']).optional().default('wav'),
  language: z.string().optional(),
  avatar: AvatarStyleOptionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  model: z.string().optional(),
});

export type GenerateAvatarSpeechOptions = z.infer<typeof GenerateAvatarSpeechOptionsSchema>;

export const GenerateAvatarSpeechResultSchema = SynthesizeAvatarSpeechResponseSchema;
export type GenerateAvatarSpeechResult = SynthesizeAvatarSpeechResponse;

const DEFAULT_VOICE = process.env.LIVEKIT_DEFAULT_VOICE ?? '248be419-c632-4f23-adf1-5324ed7dbf1d';

export async function generateAvatarSpeech(
  text: string,
  options: GenerateAvatarSpeechOptions = {},
): Promise<GenerateAvatarSpeechResult> {
  // eslint-disable-next-line no-console
  console.log('[TTS-Wrapper] generateAvatarSpeech called with:', {
    textLength: text.length,
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    options: {
      voice: options.voice,
      format: options.format,
      language: options.language,
      hasAvatar: !!options.avatar,
      hasMetadata: !!options.metadata,
      model: options.model,
    },
  });

  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Input text must be a non-empty string');
  }

  const synthesisPayload = {
    text: normalized,
    voice: options.voice ?? DEFAULT_VOICE,
    format: options.format,
    language: options.language,
    avatar: options.avatar,
    metadata: options.metadata,
    model: options.model,
  };

  // eslint-disable-next-line no-console
  console.log('[TTS-Wrapper] Calling synthesizeAvatarSpeech with:', synthesisPayload);

  const response = await synthesizeAvatarSpeech(synthesisPayload);

  // eslint-disable-next-line no-console
  console.log('[TTS-Wrapper] generateAvatarSpeech received response:', {
    requestId: response.requestId,
    hasAudioUrl: !!response.audioUrl,
    audioUrlLength: response.audioUrl?.length ?? 0,
    hasAvatarUrl: !!response.avatarUrl,
    durationSeconds: response.durationSeconds,
    approximateLatencyMs: response.approximateLatencyMs,
    hasTranscript: !!response.transcript,
  });

  return response;
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  triggerCliRun(process.argv.slice(2)).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to generate LiveKit speech:', error);
    process.exitCode = 1;
  });
}

async function triggerCliRun(args: string[]): Promise<void> {
  const textArgs = args.filter((arg) => !arg.startsWith('--'));
  const flagArgs = args.filter((arg) => arg.startsWith('--'));

  const inputText = textArgs.join(' ') || 'Hello from LectureGen!';

  const options = flagArgs.reduce<GenerateAvatarSpeechOptions>((acc, flag) => {
    const [key, value] = flag.slice(2).split('=');
    if (!value) {
      return acc;
    }

    switch (key) {
      case 'voice':
        acc.voice = value;
        break;
      case 'language':
        acc.language = value;
        break;
      case 'model':
        acc.model = value;
        break;
      default:
        break;
    }

    return acc;
  }, {});

  const result = await generateAvatarSpeech(inputText, options);
  // eslint-disable-next-line no-console
  console.log('Generated LiveKit speech:', result);
  await logOutputs(inputText, result);
}

async function logOutputs(text: string, result: GenerateAvatarSpeechResult): Promise<void> {
  const outputsDir = path.resolve(process.cwd(), '@test-outputs');
  await mkdir(outputsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `livekit-tts-${timestamp}.json`;
  const destination = path.join(outputsDir, filename);

  const payload = {
    requestedText: text,
    receivedAt: new Date().toISOString(),
    requestId: result.requestId,
    audioUrl: result.audioUrl ?? null,
    avatarUrl: result.avatarUrl ?? null,
    transcript: result.transcript ?? null,
    durationSeconds: result.durationSeconds ?? null,
    approximateLatencyMs: result.approximateLatencyMs ?? null,
  };

  await writeFile(destination, JSON.stringify(payload, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Logged LiveKit response to @test-outputs/${filename}`);
  if (result.audioUrl) {
    // eslint-disable-next-line no-console
    console.log('Audio asset URL:', result.audioUrl);
  }
  if (result.avatarUrl) {
    // eslint-disable-next-line no-console
    console.log('Avatar asset URL:', result.avatarUrl);
  }
}
