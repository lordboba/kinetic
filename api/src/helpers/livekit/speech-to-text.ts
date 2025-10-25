import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { getLiveKitConfig } from './config.js';
import { LiveKitRestClient } from './rest.js';

const DEFAULT_STT_PATH = '/v1/audio/stt';

export const SpeechSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('buffer'),
    data: z.instanceof(Buffer),
    mimeType: z.string().optional(),
  }),
  z.object({
    kind: z.literal('base64'),
    data: z.string(),
    mimeType: z.string().optional(),
  }),
  z.object({
    kind: z.literal('url'),
    url: z.string(),
  }),
]);

export type SpeechSource = z.infer<typeof SpeechSourceSchema>;

export const SpeechToTextRequestSchema = z.object({
  source: SpeechSourceSchema,
  language: z.string().optional(),
  enableTimestamps: z.boolean().optional(),
  hints: z.array(z.string()).optional(),
  endpointPath: z.string().optional(),
});

export type SpeechToTextRequest = z.infer<typeof SpeechToTextRequestSchema>;

export const SpeechToTextSegmentSchema = z.object({
  text: z.string(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  confidence: z.number().optional(),
});

export type SpeechToTextSegment = z.infer<typeof SpeechToTextSegmentSchema>;

export const SpeechToTextResponseSchema = z.object({
  requestId: z.string(),
  text: z.string(),
  segments: z.array(SpeechToTextSegmentSchema).optional(),
  detectedLanguage: z.string().optional(),
  confidence: z.number().optional(),
});

export type SpeechToTextResponse = z.infer<typeof SpeechToTextResponseSchema>;

export async function speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
  const config = getLiveKitConfig();
  const client = new LiveKitRestClient(config);

  const body = {
    audio: normalizeSource(request.source),
    language: request.language,
    enable_timestamps: request.enableTimestamps ?? true,
    vocabulary_hints: request.hints,
  };

  const endpoint = request.endpointPath ?? DEFAULT_STT_PATH;
  const response = await client.postJson<typeof body, SpeechToTextResponse>(endpoint, body);
  return response;
}

function normalizeSource(source: SpeechSource): Record<string, unknown> {
  switch (source.kind) {
    case 'buffer':
      return {
        type: 'base64',
        data: source.data.toString('base64'),
        mime_type: source.mimeType ?? 'audio/webm',
      };
    case 'base64':
      return {
        type: 'base64',
        data: source.data,
        mime_type: source.mimeType ?? 'audio/webm',
      };
    case 'url':
      return {
        type: 'url',
        url: source.url,
      };
    default: {
      const _never: never = source;
      return _never;
    }
  }
}
