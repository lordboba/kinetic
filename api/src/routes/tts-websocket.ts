import type { RouteHandler } from 'fastify';
import type { WebsocketHandler } from '@fastify/websocket';
import { z } from 'zod';

import { generateAvatarSpeech } from '../helpers/livekit/tts.js';

const TtsRequestSchema = z.object({
  type: z.literal('synthesize').optional(),
  text: z.string().min(1, 'text is required'),
  voice: z.string().optional(),
  language: z.string().optional(),
  model: z.string().optional(),
});

type TtsRequest = z.infer<typeof TtsRequestSchema>;

const READY_MESSAGE = JSON.stringify({ type: 'ready' });

export function createTtsHttpHandler(): RouteHandler {
  return async (_request, reply) => {
    reply.code(426).send({
      error: 'upgrade_required',
      message: 'Connect to this endpoint via WebSocket to request text-to-speech synthesis.',
    });
  };
}

export function createTtsWebsocketHandler(): WebsocketHandler {
  return (socket) => {
    // eslint-disable-next-line no-console
    console.log('[TTS-WS] New WebSocket connection established');
    socket.send(READY_MESSAGE);

    let processing = false;

    socket.on('message', async (rawMessage) => {
      // eslint-disable-next-line no-console
      console.log('[TTS-WS] Received message:', {
        type: typeof rawMessage,
        length: rawMessage.length,
      });

      if (processing) {
        // eslint-disable-next-line no-console
        console.log('[TTS-WS] Request rejected: already processing another request');
        socket.send(
          JSON.stringify({
            type: 'tts.error',
            message: 'Another synthesis request is already being processed',
          }),
        );
        return;
      }

      let payload: TtsRequest;
      try {
        const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf8');
        // eslint-disable-next-line no-console
        console.log('[TTS-WS] Raw message text:', text);
        payload = TtsRequestSchema.parse(JSON.parse(text));
        // eslint-disable-next-line no-console
        console.log('[TTS-WS] Parsed payload:', payload);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TTS-WS] Invalid payload:', error);
        socket.send(
          JSON.stringify({
            type: 'tts.error',
            message: `Invalid request payload: ${error instanceof Error ? error.message : 'unknown error'}`,
          }),
        );
        return;
      }

      processing = true;
      // eslint-disable-next-line no-console
      console.log('[TTS-WS] Starting synthesis...');
      try {
        const result = await generateAvatarSpeech(payload.text, {
          voice: payload.voice,
          language: payload.language,
          model: payload.model,
          format: 'wav',
        });

        const responsePayload = {
          type: 'tts.result',
          requestId: result.requestId,
          audioUrl: result.audioUrl ?? null,
          durationSeconds: result.durationSeconds ?? null,
          approximateLatencyMs: result.approximateLatencyMs ?? null,
          transcript: result.transcript ?? null,
        };

        // eslint-disable-next-line no-console
        console.log('[TTS-WS] Sending result:', {
          type: responsePayload.type,
          requestId: responsePayload.requestId,
          hasAudioUrl: !!responsePayload.audioUrl,
          audioUrlLength: responsePayload.audioUrl?.length ?? 0,
          durationSeconds: responsePayload.durationSeconds,
          approximateLatencyMs: responsePayload.approximateLatencyMs,
        });

        socket.send(JSON.stringify(responsePayload));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TTS-WS] Error during synthesis:', error);
        socket.send(
          JSON.stringify({
            type: 'tts.error',
            message: error instanceof Error ? error.message : 'Unknown LiveKit TTS error',
          }),
        );
      } finally {
        processing = false;
        // eslint-disable-next-line no-console
        console.log('[TTS-WS] Request processing completed');
      }
    });

    socket.on('close', () => {
      // eslint-disable-next-line no-console
      console.log('[TTS-WS] WebSocket connection closed');
    });

    socket.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('[TTS-WS] WebSocket error:', error);
    });
  };
}
