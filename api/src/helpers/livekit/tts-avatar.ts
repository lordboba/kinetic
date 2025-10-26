import { inference, tts as ttsNamespace } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { audioFramesToWav } from './audio-utils.js';
import { ensureLiveKitLogger, getLiveKitConfig, requireLiveKitSecret } from './config.js';
import {
  DEFAULT_VOICEOVER_SIGNED_URL_TTL_MS,
  uploadVoiceoverBuffer,
} from '../storage/voiceovers.js';

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

  // eslint-disable-next-line no-console
  console.log('[TTS] Starting stream...');
  const stream = ttsClient.stream();

  stream.pushText(payload.text);
  stream.flush();
  stream.endInput();
  // eslint-disable-next-line no-console
  console.log('[TTS] Text pushed to stream, waiting for audio chunks...');

  const frames: AudioFrame[] = [];
  let transcript = '';
  let requestId: string | undefined;
  let firstFrameTimestamp: number | undefined;
  const startTime = Date.now();
  let chunkCount = 0;

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
      frames.push(chunk.frame);

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

    const metadata = payload.metadata ?? {};
    const lectureIdRaw = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).lectureId : undefined;
    const slideIndexRaw = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).slideIndex ?? (metadata as Record<string, unknown>).slide_index : undefined;

    const lectureId = typeof lectureIdRaw === 'string' && lectureIdRaw.length > 0 ? lectureIdRaw : undefined;
    const slideIndexValue = typeof slideIndexRaw === 'number'
      ? slideIndexRaw
      : Number.isFinite(Number.parseInt(String(slideIndexRaw ?? ''), 10))
        ? Number.parseInt(String(slideIndexRaw ?? ''), 10)
        : undefined;

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
  }
}
