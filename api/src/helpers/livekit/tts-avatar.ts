import { inference, tts as ttsNamespace } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';
import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import { z } from 'zod';

import { audioFramesToWav } from './audio-utils.js';
import { ensureLiveKitLogger, getLiveKitConfig, requireLiveKitSecret } from './config.js';
import {
  DEFAULT_VOICEOVER_SIGNED_URL_TTL_MS,
  uploadVoiceoverBuffer,
} from '../storage/voiceovers.js';

function parseEnvInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const CHUNK_LOG_LIMIT = parseEnvInteger(process.env.LIVEKIT_TTS_CHUNK_LOG_LIMIT, 3);
const FIRST_CHUNK_TIMEOUT_MS = parseEnvInteger(process.env.LIVEKIT_TTS_FIRST_CHUNK_TIMEOUT_MS, 15_000);

export type TtsStreamChunk = {
  requestId?: string;
  deltaText?: string;
  frame: AudioFrame;
  chunkIndex: number;
};

export type TtsStreamCallbacks = {
  onChunk?: (chunk: TtsStreamChunk) => void | Promise<void>;
};

export const AvatarStyleOptionsSchema = z.object({
  avatarId: z.string().optional(),
  pose: z.string().optional(),
  camera: z.string().optional(),
});

export type AvatarStyleOptions = z.infer<typeof AvatarStyleOptionsSchema>;

export const SynthesizeAvatarSpeechRequestSchema = z.object({
  text: z.string(),
  voice: z.string(),
  format: z.enum(['mp3', 'wav', 'ogg']).optional().default('wav'),
  language: z.string().optional().default('en-US'),
  avatar: AvatarStyleOptionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  model: z.string().optional(),
});

export type SynthesizeAvatarSpeechRequest = z.infer<typeof SynthesizeAvatarSpeechRequestSchema>;

export const SynthesizeAvatarSpeechResponseSchema = z.object({
  requestId: z.string(),
  audioUrl: z.string().optional(),
  avatarUrl: z.string().optional(),
  durationSeconds: z.number().optional(),
  approximateLatencyMs: z.number().optional(),
  transcript: z.string().optional(),
});

export type SynthesizeAvatarSpeechResponse = z.infer<typeof SynthesizeAvatarSpeechResponseSchema>;

export async function synthesizeAvatarSpeech(
  payload: SynthesizeAvatarSpeechRequest,
  callbacks?: TtsStreamCallbacks,
): Promise<SynthesizeAvatarSpeechResponse> {
  // eslint-disable-next-line no-console
  console.log('[TTS] Starting synthesizeAvatarSpeech with payload:', {
    textLength: payload.text.length,
    text: payload.text.substring(0, 100) + (payload.text.length > 100 ? '...' : ''),
    voice: payload.voice,
    format: payload.format,
    language: payload.language,
    model: payload.model,
    hasAvatar: !!payload.avatar,
    hasMetadata: !!payload.metadata,
  });

  const format = payload.format ?? 'wav';
  if (format !== 'wav') {
    throw new Error(`LiveKit inference streaming TTS currently supports only WAV output (requested ${format})`);
  }

  const config = getLiveKitConfig();
  ensureLiveKitLogger();
  const secret = requireLiveKitSecret(config);
  const inferenceConfig = config.inference;

  const resolvedModel = payload.model ?? inferenceConfig?.defaultTtsModel;
  if (!resolvedModel) {
    throw new Error(
      'LiveKit TTS model is not configured. Provide payload.model or set LIVEKIT_INFERENCE_TTS_MODEL environment variable.',
    );
  }

  const resolvedVoice = payload.voice || inferenceConfig?.defaultTtsVoice;

  // eslint-disable-next-line no-console
  console.log('[TTS] Creating TTS client:', {
    model: resolvedModel,
    voice: resolvedVoice,
    language: payload.language,
    baseURL: inferenceConfig?.baseUrl,
    hasApiKey: !!(inferenceConfig?.apiKey ?? config.apiKey),
    hasApiSecret: !!(inferenceConfig?.apiSecret ?? secret),
  });

  const ttsClient = new inference.TTS({
    model: resolvedModel,
    voice: resolvedVoice,
    language: payload.language,
    baseURL: inferenceConfig?.baseUrl,
    apiKey: inferenceConfig?.apiKey ?? config.apiKey,
    apiSecret: inferenceConfig?.apiSecret ?? secret,
  });

  const logLiveKitError = (error: unknown) => {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    if (typeof error === 'object' && error !== null) {
      return {
        ...(error as Record<string, unknown>),
      };
    }
    return { message: String(error) };
  };

  ttsClient.on('error', (event) => {
    // eslint-disable-next-line no-console
    console.error('[TTS] LiveKit client emitted error event:', {
      label: event.label,
      recoverable: event.recoverable,
      timestamp: event.timestamp,
      details: logLiveKitError(event.error),
    });
  });

  ttsClient.on('metrics_collected', (metrics) => {
    // eslint-disable-next-line no-console
    console.log('[TTS] LiveKit metrics collected:', {
      requestId: metrics.requestId,
      characters: metrics.charactersCount,
      durationMs: metrics.durationMs,
      ttfbMs: metrics.ttfbMs,
      audioDurationMs: metrics.audioDurationMs,
      cancelled: metrics.cancelled,
      streamed: metrics.streamed,
      label: metrics.label,
    });
  });

  const metadata = payload.metadata ?? {};
  const lectureIdRaw =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).lectureId : undefined;
  const slideIndexRaw =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).slideIndex ??
        (metadata as Record<string, unknown>).slide_index
      : undefined;

  const lectureId =
    typeof lectureIdRaw === 'string' && lectureIdRaw.length > 0 ? lectureIdRaw : undefined;
  const slideIndexValue =
    typeof slideIndexRaw === 'number'
      ? slideIndexRaw
      : Number.isFinite(Number.parseInt(String(slideIndexRaw ?? ''), 10))
        ? Number.parseInt(String(slideIndexRaw ?? ''), 10)
        : undefined;

  // eslint-disable-next-line no-console
  console.log('[TTS] Starting stream...');
  const stream = ttsClient.stream();

  const textStream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(payload.text);
      controller.close();
    },
  });
  stream.updateInputStream(textStream);
  // eslint-disable-next-line no-console
  console.log('[TTS] Text pushed to stream, waiting for audio chunks...');

  const frames: AudioFrame[] = [];
  let transcript = '';
  let requestId: string | undefined;
  let firstFrameTimestamp: number | undefined;
  const startTime = Date.now();
  let chunkCount = 0;
  let loggedChunkSummaries = 0;
  let firstChunkWarningTimer: ReturnType<typeof setTimeout> | null = null;
  if (FIRST_CHUNK_TIMEOUT_MS > 0) {
    firstChunkWarningTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[TTS] No audio chunks received yet; waiting on LiveKit stream', {
        textLength: payload.text.length,
        voice: resolvedVoice,
        model: resolvedModel,
        language: payload.language,
        lectureId,
        slideIndex: slideIndexValue,
        timeoutMs: FIRST_CHUNK_TIMEOUT_MS,
      });
    }, FIRST_CHUNK_TIMEOUT_MS);
  }

  // eslint-disable-next-line no-console
  console.log(`[TTS] Stream started (model=${resolvedModel}, voice=${resolvedVoice ?? 'default'})`);

  try {
    for await (const chunk of stream) {
      if (chunk === ttsNamespace.SynthesizeStream.END_OF_STREAM) {
        // eslint-disable-next-line no-console
        console.log('[TTS] Received END_OF_STREAM signal');
        break;
      }

      chunkCount++;
      if (loggedChunkSummaries < CHUNK_LOG_LIMIT) {
        loggedChunkSummaries += 1;
        // eslint-disable-next-line no-console
        console.log(`[TTS] Chunk summary #${chunkCount}:`, {
          requestId: chunk.requestId,
          deltaChars: chunk.deltaText?.length ?? 0,
          hasFrame: !!chunk.frame,
          frameSampleRate: chunk.frame?.sampleRate,
          frameChannels: chunk.frame?.channels,
          frameSamplesPerChannel: chunk.frame?.samplesPerChannel,
          isFinal: (chunk as { final?: boolean }).final ?? false,
          segmentId: (chunk as { segmentId?: string }).segmentId,
        });
      }

      if (chunkCount === 1 && firstChunkWarningTimer) {
        clearTimeout(firstChunkWarningTimer);
        firstChunkWarningTimer = null;
      }
      // eslint-disable-next-line no-console
      /*
      console.log(`[TTS] Chunk #${chunkCount}:`, {
        requestId: chunk.requestId,
        deltaText: chunk.deltaText,
        hasFrame: !!chunk.frame,
        frameSampleRate: chunk.frame?.sampleRate,
        frameChannels: chunk.frame?.channels,
        frameSamplesPerChannel: chunk.frame?.samplesPerChannel,
      });*/

      requestId = chunk.requestId ?? requestId;
      transcript += chunk.deltaText ?? '';

      if (chunk.frame) {
        frames.push(chunk.frame);
        if (callbacks?.onChunk) {
          const chunkPayload: TtsStreamChunk = {
            requestId: chunk.requestId ?? requestId,
            deltaText: chunk.deltaText ?? undefined,
            frame: chunk.frame,
            chunkIndex: chunkCount,
          };
          try {
            await callbacks.onChunk(chunkPayload);
          } catch (chunkError) {
            // eslint-disable-next-line no-console
            console.error('[TTS] onChunk callback failed:', chunkError);
          }
        }
      }

      if (firstFrameTimestamp === undefined) {
        firstFrameTimestamp = Date.now();
        // eslint-disable-next-line no-console
        console.log('[TTS] First frame received, latency:', firstFrameTimestamp - startTime, 'ms');
      }
    }

    // eslint-disable-next-line no-console
    console.log('[TTS] Stream completed:', {
      totalChunks: chunkCount,
      framesCollected: frames.length,
      transcriptLength: transcript.length,
      transcript: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
    });

    if (frames.length === 0) {
      const errorMetadata = {
        requestId,
        textLength: payload.text.length,
        lectureId,
        slideIndex: slideIndexValue,
        model: resolvedModel,
        voice: resolvedVoice,
        language: payload.language,
        chunkCount,
        chunkSummariesLogged: loggedChunkSummaries,
      };
      // eslint-disable-next-line no-console
      console.error('[TTS] Stream returned zero audio frames:', errorMetadata);
      throw new Error('LiveKit TTS did not return any audio frames');
    }

    // eslint-disable-next-line no-console
    console.log('[TTS] Converting frames to WAV...');
    const wavBuffer = audioFramesToWav(frames);
    const totalDurationSeconds = frames.reduce((acc, frame) => acc + frame.samplesPerChannel / frame.sampleRate, 0);
    const approximateLatencyMs = firstFrameTimestamp ? firstFrameTimestamp - startTime : undefined;

    // eslint-disable-next-line no-console
    console.log('[TTS] WAV conversion complete:', {
      wavBufferSize: wavBuffer.length,
      durationSeconds: totalDurationSeconds,
      approximateLatencyMs,
    });

    const resolvedRequestId = requestId ?? randomUUID();

    let audioUrl: string | undefined;
    try {
      const uploadResult = await uploadVoiceoverBuffer({
        lectureId,
        slideIndex: slideIndexValue,
        buffer: wavBuffer,
        mimeType: 'audio/wav',
        filenameHint: Number.isFinite(slideIndexValue)
          ? `slide-${String(Number(slideIndexValue) + 1).padStart(2, '0')}`
          : resolvedRequestId,
        customMetadata: {
          requestId: resolvedRequestId,
        },
        expiresInMs: DEFAULT_VOICEOVER_SIGNED_URL_TTL_MS,
        cacheControl: 'public,max-age=31536000,immutable',
      });
      audioUrl = uploadResult.signedUrl;

      // eslint-disable-next-line no-console
      console.log('[TTS] Uploaded voiceover to storage:', {
        objectPath: uploadResult.storagePath,
        signedUrlLength: audioUrl.length,
        expires: uploadResult.expiresAt,
      });
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error('[TTS] Failed to upload voiceover to storage, falling back to data URL:', storageError);
    }

    if (!audioUrl) {
      const base64Audio = wavBuffer.toString('base64');
      audioUrl = `data:audio/wav;base64,${base64Audio}`;
      // eslint-disable-next-line no-console
      console.log('[TTS] Base64 fallback used for voiceover:', {
        dataUrlLength: audioUrl.length,
      });
    }

    const response: SynthesizeAvatarSpeechResponse = {
      requestId: resolvedRequestId,
      audioUrl,
      avatarUrl: undefined,
      durationSeconds: Number.isFinite(totalDurationSeconds) ? totalDurationSeconds : undefined,
      approximateLatencyMs,
      transcript: transcript.trim() || undefined,
    };

    // eslint-disable-next-line no-console
    console.log('[TTS] Response payload:', {
      requestId: response.requestId,
      audioUrlIsSigned: audioUrl?.startsWith('http'),
      audioUrlLength: response.audioUrl?.length ?? 0,
      durationSeconds: response.durationSeconds,
      approximateLatencyMs: response.approximateLatencyMs,
      transcript: response.transcript,
    });

    return response;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[TTS] Error during synthesis:', error);
    throw error;
  } finally {
    if (firstChunkWarningTimer) {
      clearTimeout(firstChunkWarningTimer);
    }
    try {
      stream.close();
    } catch (closeError) {
      // eslint-disable-next-line no-console
      console.warn('[TTS] Failed to close TTS stream cleanly:', closeError);
    }
    try {
      await ttsClient.close();
    } catch (clientCloseError) {
      // eslint-disable-next-line no-console
      console.warn('[TTS] Failed to close TTS client cleanly:', clientCloseError);
    }
  }
}
