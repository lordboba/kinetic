import { z } from 'zod';

import type { AvatarStyleOptions, SynthesizeAvatarSpeechResponse } from './tts-avatar.js';
import { AvatarStyleOptionsSchema, SynthesizeAvatarSpeechResponseSchema, synthesizeAvatarSpeech } from './tts-avatar.js';

export const GenerateAvatarSpeechOptionsSchema = z.object({
  voice: z.string().optional(),
  format: z.enum(['mp3', 'wav', 'ogg']).optional(),
  language: z.string().optional(),
  avatar: AvatarStyleOptionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  endpointPath: z.string().optional(),
});

export type GenerateAvatarSpeechOptions = z.infer<typeof GenerateAvatarSpeechOptionsSchema>;

export const GenerateAvatarSpeechResultSchema = SynthesizeAvatarSpeechResponseSchema;
export type GenerateAvatarSpeechResult = SynthesizeAvatarSpeechResponse;

const DEFAULT_VOICE = process.env.LIVEKIT_DEFAULT_VOICE ?? 'alloy';

export async function generateAvatarSpeech(
  text: string,
  options: GenerateAvatarSpeechOptions = {},
): Promise<GenerateAvatarSpeechResult> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Input text must be a non-empty string');
  }

  const response = await synthesizeAvatarSpeech({
    text: normalized,
    voice: options.voice ?? DEFAULT_VOICE,
    format: options.format,
    language: options.language,
    avatar: options.avatar,
    metadata: options.metadata,
    endpointPath: options.endpointPath,
  });

  return response;
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  const inputText = process.argv.slice(2).join(' ') || 'Hello from LectureGen!';
  triggerCliRun(inputText).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to generate LiveKit speech:', error);
    process.exitCode = 1;
  });
}

async function triggerCliRun(inputText: string): Promise<void> {
  const result = await generateAvatarSpeech(inputText);
  // eslint-disable-next-line no-console
  console.log('Generated LiveKit speech:', result);
}

await generateAvatarSpeech('Hello, world!').then(console.log);
