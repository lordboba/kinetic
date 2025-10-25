import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { getLiveKitConfig, requireLiveKitSecret } from './config.js';

export const LiveKitTokenOptionsSchema = z.object({
  identity: z.string().optional(),
  ttlSeconds: z.number().optional(),
  metadata: z.string().optional(),
  room: z.string().optional(),
  name: z.string().optional(),
});

export type LiveKitTokenOptions = z.infer<typeof LiveKitTokenOptionsSchema>;

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
