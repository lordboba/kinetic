import { Buffer } from 'node:buffer';

import { getLiveKitConfig } from './config.js';
import { LiveKitRestClient } from './rest.js';

const DEFAULT_STT_PATH = '/v1/audio/stt';

export type SpeechSource =
  | { kind: 'buffer'; data: Buffer; mimeType?: string }
  | { kind: 'base64'; data: string; mimeType?: string }
  | { kind: 'url'; url: string };

export type SpeechToTextRequest = {
  source: SpeechSource;
  language?: string;
  enableTimestamps?: boolean;
  hints?: string[];
  endpointPath?: string;
};

export type SpeechToTextSegment = {
  text: string;
  startTime?: number;
  endTime?: number;
  confidence?: number;
};

export type SpeechToTextResponse = {
  requestId: string;
  text: string;
  segments?: SpeechToTextSegment[];
  detectedLanguage?: string;
  confidence?: number;
};

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
