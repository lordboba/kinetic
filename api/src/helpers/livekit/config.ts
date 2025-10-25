import { initializeLogger as initializeLiveKitLogger } from '@livekit/agents';
import {config as loadEnv} from 'dotenv';
import path from 'node:path';
import { URL } from 'node:url';
import { z } from 'zod';

export const LiveKitConfigSchema = z.object({
  websocketUrl: z.string(),
  apiKey: z.string(),
  apiSecret: z.string().optional(),
  requestTimeoutMs: z.number(),
  inference: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      defaultSttModel: z.string().optional(),
      defaultSttLanguage: z.string().optional(),
      defaultTtsModel: z.string().optional(),
      defaultTtsVoice: z.string().optional(),
    })
    .optional(),
});

export type LiveKitConfig = z.infer<typeof LiveKitConfigSchema>;

const DEFAULT_TIMEOUT_MS = 15_000;
let loggerInitialized = false;

export function getLiveKitConfig(): LiveKitConfig {
  //console.log(path.resolve(import.meta.dirname, "../../../../.env"));
  loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });
  
  const websocketUrl = process.env.LIVEKIT_WEBSOCKET_URL ?? '';
  const apiKey = process.env.LIVEKIT_API_KEY ?? '';
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? process.env.LIVEKIT_API_SECRET_KEY;
  const timeoutOverride = process.env.LIVEKIT_REQUEST_TIMEOUT_MS;

  if (!websocketUrl) {
    throw new Error('LIVEKIT_WEBSOCKET_URL environment variable is required for LiveKit helpers');
  }

  if (!apiKey) {
    throw new Error('LIVEKIT_API_KEY environment variable is required for LiveKit helpers');
  }

  const requestTimeoutMs =
    timeoutOverride !== undefined ? Number.parseInt(timeoutOverride, 10) || DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const inferenceBaseUrl = process.env.LIVEKIT_INFERENCE_URL ?? undefined;
  const inferenceApiKey = process.env.LIVEKIT_INFERENCE_API_KEY ?? undefined;
  const inferenceApiSecret =
    process.env.LIVEKIT_INFERENCE_API_SECRET ?? process.env.LIVEKIT_INFERENCE_API_SECRET_KEY ?? undefined;
  const inferenceDefaultSttModel = process.env.LIVEKIT_INFERENCE_STT_MODEL ?? undefined;
  const inferenceDefaultSttLanguage = process.env.LIVEKIT_INFERENCE_STT_LANGUAGE ?? undefined;
  const inferenceDefaultTtsModel = process.env.LIVEKIT_INFERENCE_TTS_MODEL ?? undefined;
  const inferenceDefaultTtsVoice = process.env.LIVEKIT_INFERENCE_TTS_VOICE ?? undefined;

  const inferenceConfig =
    inferenceBaseUrl ||
    inferenceApiKey ||
    inferenceApiSecret ||
    inferenceDefaultSttModel ||
    inferenceDefaultSttLanguage ||
    inferenceDefaultTtsModel ||
    inferenceDefaultTtsVoice
      ? {
          baseUrl: inferenceBaseUrl,
          apiKey: inferenceApiKey ?? apiKey,
          apiSecret: inferenceApiSecret ?? apiSecret ?? undefined,
          defaultSttModel: inferenceDefaultSttModel,
          defaultSttLanguage: inferenceDefaultSttLanguage,
          defaultTtsModel: inferenceDefaultTtsModel,
          defaultTtsVoice: inferenceDefaultTtsVoice,
        }
      : undefined;

  return {
    websocketUrl,
    apiKey,
    apiSecret: apiSecret || undefined,
    requestTimeoutMs,
    inference: inferenceConfig,
  };
}

export function ensureLiveKitLogger(): void {
  if (loggerInitialized) {
    return;
  }

  initializeLiveKitLogger({
    pretty: process.env.NODE_ENV !== 'production',
    level: process.env.LIVEKIT_LOG_LEVEL,
  });

  loggerInitialized = true;
}

export function getLiveKitRestBaseUrl(config: LiveKitConfig): string {
  const url = new URL(config.websocketUrl);
  if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  } else if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  }
  return url.toString().replace(/\/$/, '');
}

export function requireLiveKitSecret(config: LiveKitConfig): string {
  if (!config.apiSecret) {
    throw new Error('LIVEKIT_API_SECRET environment variable is required for this LiveKit helper');
  }
  return config.apiSecret;
}
