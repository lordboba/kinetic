import {config as loadEnv} from 'dotenv';
import path from 'node:path';
import { URL } from 'node:url';

export type LiveKitConfig = {
  websocketUrl: string;
  apiKey: string;
  apiSecret?: string;
  requestTimeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export function getLiveKitConfig(): LiveKitConfig {
  console.log(path.resolve(import.meta.dirname, "../../../../.env"));
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

  return {
    websocketUrl,
    apiKey,
    apiSecret: apiSecret || undefined,
    requestTimeoutMs,
  };
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
