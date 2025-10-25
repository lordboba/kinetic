import { getLiveKitConfig } from './config.js';
import { LiveKitRestClient } from './rest.js';

const DEFAULT_TTS_PATH = '/v1/audio/tts';

export type AvatarStyleOptions = {
  avatarId?: string;
  pose?: string;
  camera?: string;
};

export type SynthesizeAvatarSpeechRequest = {
  text: string;
  voice: string;
  format?: 'mp3' | 'wav' | 'ogg';
  language?: string;
  avatar?: AvatarStyleOptions;
  metadata?: Record<string, unknown>;
  endpointPath?: string;
};

export type SynthesizeAvatarSpeechResponse = {
  requestId: string;
  audioUrl?: string;
  avatarUrl?: string;
  durationSeconds?: number;
  approximateLatencyMs?: number;
  transcript?: string;
};

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
