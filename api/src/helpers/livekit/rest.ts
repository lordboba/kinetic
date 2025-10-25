import { AccessToken } from 'livekit-server-sdk';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

import { getLiveKitRestBaseUrl, requireLiveKitSecret, type LiveKitConfig } from './config.js';

export const RestRequestOptionsSchema = z.object({
  timeoutMs: z.number().optional(),
  retryCount: z.number().optional(),
});

export type RestRequestOptions = z.infer<typeof RestRequestOptionsSchema>;

type HttpMethod = 'GET' | 'POST';

export class LiveKitRestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly defaultTimeout: number;

  constructor(config: LiveKitConfig) {
    this.baseUrl = getLiveKitRestBaseUrl(config);
    this.apiKey = config.apiKey;
    this.apiSecret = requireLiveKitSecret(config);
    this.defaultTimeout = config.requestTimeoutMs;
  }

  async postJson<TBody extends object, TResponse>(
    path: string,
    body: TBody,
    options?: RestRequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', path, JSON.stringify(body), options, {
      'Content-Type': 'application/json',
    });
  }

  async request<TResponse>(
    method: HttpMethod,
    path: string,
    body: string | Uint8Array | null,
    options: RestRequestOptions | undefined,
    extraHeaders?: Record<string, string>,
  ): Promise<TResponse> {
    const retries = options?.retryCount ?? 0;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        const controller = new AbortController();
        const timeout = options?.timeoutMs ?? this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const bearerToken = await this.createBearerToken();
          const requestUrl = this.resolve(path);
          const requestStart = Date.now();

          // eslint-disable-next-line no-console
          console.log(
            `LiveKit REST request -> ${method} ${requestUrl} (attempt ${attempt + 1} of ${retries + 1})`,
          );

          const requestInit: RequestInit = {
            method,
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              Accept: 'application/json',
              ...extraHeaders,
            },
            signal: controller.signal,
          };

          if (body !== null) {
            requestInit.body = body as BodyInit;
          }

          const response = await fetch(requestUrl, requestInit);

          const durationMs = Date.now() - requestStart;
          // eslint-disable-next-line no-console
          console.log(
            `LiveKit REST response <- ${method} ${requestUrl} ${response.status} (${durationMs}ms)`,
          );
          console.log(response);
          if (!response.ok) {
            const text = await response.text();
            // eslint-disable-next-line no-console
            console.error(
              `LiveKit REST error body <- ${method} ${requestUrl} ${response.status}: ${text}`,
            );
            throw new Error(`LiveKit request failed with status ${response.status}: ${text}`);
          }

          const contentType = response.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) {
            return (await response.json()) as TResponse;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          return buffer as unknown as TResponse;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt > retries) {
          break;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `LiveKit REST retry ${attempt} scheduled after error: ${error instanceof Error ? error.message : String(error)}`,
        );
        await delay(250 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown LiveKit REST client error');
  }

  private resolve(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${sanitizedPath}`;
  }

  private createBearerToken(): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: `rest-${Date.now()}`,
      ttl: 60,
    });
    token.addGrant({
      roomAdmin: true,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    return token.toJwt();
  }
}
