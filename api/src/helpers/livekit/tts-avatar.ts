import { z } from 'zod';

import { getLiveKitConfig } from './config.js';
import { LiveKitRestClient } from './rest.js';

const DEFAULT_TTS_PATH = '/v1/audio/tts';

export const AvatarStyleOptionsSchema = z.object({
  avatarId: z.string().optional(),
  pose: z.string().optional(),
  camera: z.string().optional(),
});

export type AvatarStyleOptions = z.infer<typeof AvatarStyleOptionsSchema>;

export const SynthesizeAvatarSpeechRequestSchema = z.object({
  text: z.string(),
  voice: z.string(),
  format: z.enum(['mp3', 'wav', 'ogg']).optional(),
  language: z.string().optional(),
  avatar: AvatarStyleOptionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  endpointPath: z.string().optional(),
});

export type SynthesizeAvatarSpeechRequest = z.infer<typeof SynthesizeAvatarSpeechRequestSchema>;

export const SynthesizeAvatarSpeechResponseSchema = z.object({
  requestId: z.string(),
  audioUrl: z.string().optional(),
  avatarUrl: z.string().optional(),
  durationSeconds: z.number().optional(),
  approximateLatencyMs: z.number().optional(),
  transcript: z.string().optional(),
});

export type SynthesizeAvatarSpeechResponse = z.infer<typeof SynthesizeAvatarSpeechResponseSchema>;

export async function synthesizeAvatarSpeech(
  payload: SynthesizeAvatarSpeechRequest,
): Promise<SynthesizeAvatarSpeechResponse> {
  const config = getLiveKitConfig();
  const client = new LiveKitRestClient(config);

  const body = {
    text: payload.text,
    voice: payload.voice,
    format: payload.format ?? 'mp3',
    language: payload.language,
    avatar: payload.avatar,
    metadata: payload.metadata,
  };

  const endpoint = payload.endpointPath ?? DEFAULT_TTS_PATH;
  const response = await client.postJson<typeof body, SynthesizeAvatarSpeechResponse>(endpoint, body);

  return response;
}
