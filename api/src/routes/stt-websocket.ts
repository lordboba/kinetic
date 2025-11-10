import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { speechToText } from "../helpers/livekit/speech-to-text";
import type { WebsocketHandler } from "@fastify/websocket";
import { Buffer } from "node:buffer";

const READY_MESSAGE = JSON.stringify({ type: "ready" });

// Schema for incoming STT JSON requests (optional metadata)
const SttRequestSchema = z.object({
  language: z.string().optional().default("en"),
  model: z.string().optional(),
});

type SttRequest = z.infer<typeof SttRequestSchema>;

export function createSttWebsocketHandler(): WebsocketHandler {
  return (socket) => {
    console.log('[STT WebSocket] Client connected');
    socket.send(READY_MESSAGE);
    let processing = false;
    let options: SttRequest = { language: "en" };

    socket.on('message', async (rawMessage: Buffer | string) => {
      if (processing) {
        socket.send(JSON.stringify({
          type: 'stt.error',
          message: 'Another transcription is already in progress',
        }));
        return;
      }

      // If message is JSON string, treat it as options
      if (typeof rawMessage === 'string') {
        try {
          const parsed = JSON.parse(rawMessage);
          const validatedOptions = SttRequestSchema.safeParse(parsed);
          if (validatedOptions.success) {
            options = validatedOptions.data;
            console.log('[STT WebSocket] Options updated:', options);
            socket.send(JSON.stringify({
              type: 'stt.options_updated',
              options,
            }));
          }
        } catch (error) {
          console.warn('[STT WebSocket] Ignoring invalid JSON options');
        }
        return;
      }

      // If message is Buffer, treat it as audio data
      if (Buffer.isBuffer(rawMessage)) {
        processing = true;
        console.log('[STT WebSocket] Processing binary audio, size:', rawMessage.length);

        try {
          // Use existing LiveKit STT helper with buffer (much faster than base64!)
          const result = await speechToText({
            source: {
              kind: 'buffer',
              data: rawMessage,
              mimeType: 'audio/webm',
            },
            language: options.language,
            model: options.model,
          });

          console.log('[STT WebSocket] Transcription successful:', result.text);

          socket.send(JSON.stringify({
            type: 'stt.result',
            requestId: result.requestId,
            text: result.text,
            segments: result.segments,
            detectedLanguage: result.detectedLanguage,
            confidence: result.confidence,
          }));
        } catch (error) {
          console.error('[STT WebSocket] Transcription error:', error);
          socket.send(JSON.stringify({
            type: 'stt.error',
            message: error instanceof Error ? error.message : 'Unknown STT error',
          }));
        } finally {
          processing = false;
        }
      }
    });

    socket.on('close', () => {
      console.log('[STT WebSocket] Client disconnected');
    });

    socket.on('error', (error) => {
      console.error('[STT WebSocket] Error:', error);
    });
  };
}

export function createHttpHandler() {
  return async (_req: FastifyRequest, res: FastifyReply) => {
    return res.status(426).send({
      error: 'Upgrade Required',
      message: 'This endpoint requires a WebSocket connection',
    });
  };
}
