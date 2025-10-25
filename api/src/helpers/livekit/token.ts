import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';

import { getLiveKitConfig, requireLiveKitSecret } from './config.js';

export type LiveKitTokenOptions = {
  identity?: string;
  ttlSeconds?: number;
  metadata?: string;
  room?: string;
  name?: string;
};

export async function createLiveKitAccessToken(options: LiveKitTokenOptions = {}): Promise<string> {
  const config = getLiveKitConfig();
  const apiSecret = requireLiveKitSecret(config);

  const token = new AccessToken(config.apiKey, apiSecret, {
    identity: options.identity ?? `backend-${randomUUID()}`,
    ttl: options.ttlSeconds ?? 60 * 60,
    name: options.name,
    metadata: options.metadata,
  });

  if (options.room) {
    token.addGrant({
      roomJoin: true,
      room: options.room,
      canPublish: true,
      canSubscribe: true,
    });
  }

  return token.toJwt();
}
