import { inference, stt as sttNamespace } from '@livekit/agents';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { decodeWav, isWav, pcmToAudioFrames, type DecodedAudio } from './audio-utils.js';
import { ensureLiveKitLogger, getLiveKitConfig, requireLiveKitSecret } from './config.js';

export const SpeechSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('buffer'),
    data: z.instanceof(Buffer),
    mimeType: z.string().optional(),
  }),
  z.object({
    kind: z.literal('base64'),
    data: z.string(),
    mimeType: z.string().optional(),
  }),
  z.object({
    kind: z.literal('url'),
    url: z.string(),
  }),
]);

export type SpeechSource = z.infer<typeof SpeechSourceSchema>;

export const SpeechToTextRequestSchema = z.object({
  source: SpeechSourceSchema,
  language: z.string().optional(),
  enableTimestamps: z.boolean().optional(),
  hints: z.array(z.string()).optional(),
  model: z.string().optional(),
});

export type SpeechToTextRequest = z.infer<typeof SpeechToTextRequestSchema>;

export const SpeechToTextSegmentSchema = z.object({
  text: z.string(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  confidence: z.number().optional(),
});

export type SpeechToTextSegment = z.infer<typeof SpeechToTextSegmentSchema>;

export const SpeechToTextResponseSchema = z.object({
  requestId: z.string(),
  text: z.string(),
  segments: z.array(SpeechToTextSegmentSchema).optional(),
  detectedLanguage: z.string().optional(),
  confidence: z.number().optional(),
});

export type SpeechToTextResponse = z.infer<typeof SpeechToTextResponseSchema>;

export async function speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
  const config = getLiveKitConfig();
  ensureLiveKitLogger();
  const secret = requireLiveKitSecret(config);
  const inferenceConfig = config.inference;

  const sttModel = request.model ?? inferenceConfig?.defaultSttModel;
  const sttLanguage = request.language ?? inferenceConfig?.defaultSttLanguage;

  // eslint-disable-next-line no-console
  console.log('[STT] Starting speech-to-text request:', {
    sourceKind: request.source.kind,
    model: sttModel,
    language: sttLanguage,
    enableTimestamps: request.enableTimestamps,
    hints: request.hints,
  });

  const sttClient = new inference.STT({
    model: sttModel,
    language: sttLanguage,
    baseURL: inferenceConfig?.baseUrl,
    apiKey: inferenceConfig?.apiKey ?? config.apiKey,
    apiSecret: inferenceConfig?.apiSecret ?? secret,
  });

  // eslint-disable-next-line no-console
  console.log('[STT] Loading audio source...');
  const audioPayload = await loadAudioSource(request.source);
  // eslint-disable-next-line no-console
  console.log('[STT] Audio loaded:', {
    bufferSize: audioPayload.buffer.length,
    mimeType: audioPayload.mimeType,
  });

  // eslint-disable-next-line no-console
  console.log('[STT] Decoding audio...');
  const decodedAudio = decodeAudio(audioPayload.buffer, audioPayload.mimeType);
  // eslint-disable-next-line no-console
  console.log('[STT] Audio decoded:', {
    sampleRate: decodedAudio.sampleRate,
    channels: decodedAudio.channels,
    totalSamples: decodedAudio.samples.length,
    durationSeconds: decodedAudio.samples.length / decodedAudio.sampleRate / decodedAudio.channels,
  });

  // eslint-disable-next-line no-console
  console.log('[STT] Converting to audio frames...');
  const frames = pcmToAudioFrames(decodedAudio.samples, decodedAudio.sampleRate, decodedAudio.channels);
  // eslint-disable-next-line no-console
  console.log('[STT] Created frames:', {
    frameCount: frames.length,
    firstFrameSampleRate: frames[0]?.sampleRate,
    firstFrameChannels: frames[0]?.channels,
    firstFrameSamplesPerChannel: frames[0]?.samplesPerChannel,
  });

  if (frames.length === 0) {
    throw new Error('Unable to decode any audio frames from provided source');
  }

  const stream = sttClient.stream({ language: sttLanguage });

  try {
    // eslint-disable-next-line no-console
    console.log(`[STT] Pushing ${frames.length} frames to stream...`);
    for (const frame of frames) {
      stream.pushFrame(frame);
    }
    stream.endInput();
    // eslint-disable-next-line no-console
    console.log('[STT] All frames pushed, waiting for recognition events...');

    const segments: SpeechToTextSegment[] = [];
    let interimText = '';
    let detectedLanguage: string | undefined;
    let requestId: string | undefined;
    let confidenceAccumulator = 0;
    let confidenceCount = 0;
    let eventCount = 0;

    // eslint-disable-next-line no-console
    console.log(
      `[STT] Stream started (model=${sttModel ?? 'default'}, language=${sttLanguage ?? 'auto'})`,
    );

    for await (const event of stream) {
      eventCount++;
      // eslint-disable-next-line no-console
      console.log(`[STT] Event #${eventCount}:`, {
        type: event.type,
        requestId: event.requestId,
        alternativesCount: event.alternatives?.length ?? 0,
      });

      if (event.type === sttNamespace.SpeechEventType.RECOGNITION_USAGE) {
        // eslint-disable-next-line no-console
        console.log('[STT] Recognition usage event (skipping)');
        continue;
      }

      const alternative = event.alternatives?.[0];
      if (!alternative) {
        // eslint-disable-next-line no-console
        console.log('[STT] No alternatives in event (skipping)');
        continue;
      }

      // eslint-disable-next-line no-console
      console.log('[STT] Alternative:', {
        text: alternative.text,
        language: alternative.language,
        confidence: alternative.confidence,
        startTime: alternative.startTime,
        endTime: alternative.endTime,
      });

      requestId = event.requestId ?? requestId;

      if (!detectedLanguage && alternative.language) {
        detectedLanguage = alternative.language;
        // eslint-disable-next-line no-console
        console.log('[STT] Detected language:', detectedLanguage);
      }

      if (event.type === sttNamespace.SpeechEventType.INTERIM_TRANSCRIPT) {
        interimText = alternative.text;
        // eslint-disable-next-line no-console
        console.log('[STT] Interim transcript:', interimText);
        continue;
      }

      if (
        event.type === sttNamespace.SpeechEventType.FINAL_TRANSCRIPT ||
        event.type === sttNamespace.SpeechEventType.END_OF_SPEECH
      ) {
        const segment: SpeechToTextSegment = {
          text: alternative.text,
          startTime: alternative.startTime,
          endTime: alternative.endTime,
          confidence: alternative.confidence,
        };
        segments.push(segment);
        // eslint-disable-next-line no-console
        console.log('[STT] Final segment added:', segment);

        if (typeof alternative.confidence === 'number') {
          confidenceAccumulator += alternative.confidence;
          confidenceCount += 1;
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log('[STT] Stream completed:', {
      totalEvents: eventCount,
      segmentsCount: segments.length,
      hasInterimText: !!interimText,
    });

    const finalText = segments.length > 0 ? segments.map((segment) => segment.text).join(' ').trim() : interimText;

    // eslint-disable-next-line no-console
    console.log('[STT] Building final response:', {
      segmentsUsed: segments.length > 0,
      interimTextUsed: segments.length === 0 && !!interimText,
      finalTextLength: finalText.length,
    });

    const response: SpeechToTextResponse = {
      requestId: requestId ?? randomUUID(),
      text: finalText ?? '',
      segments: request.enableTimestamps === false || segments.length === 0 ? undefined : segments,
      detectedLanguage,
      confidence: confidenceCount > 0 ? confidenceAccumulator / confidenceCount : undefined,
    };

    // eslint-disable-next-line no-console
    console.log('[STT] Response payload:', {
      requestId: response.requestId,
      textLength: response.text.length,
      text: response.text,
      segmentsCount: response.segments?.length ?? 0,
      detectedLanguage: response.detectedLanguage,
      confidence: response.confidence,
    });

    return response;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[STT] Error during speech-to-text:', error);
    throw error;
  } finally {
    // eslint-disable-next-line no-console
    console.log('[STT] Cleaning up stream...');
    stream.detachInputStream?.();
  }
}

type LoadedAudio = {
  buffer: Buffer;
  mimeType?: string;
};

async function loadAudioSource(source: SpeechSource): Promise<LoadedAudio> {
  switch (source.kind) {
    case 'buffer':
      return { buffer: source.data, mimeType: source.mimeType };
    case 'base64':
      return { buffer: Buffer.from(source.data, 'base64'), mimeType: source.mimeType };
    case 'url': {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Failed to download audio from ${source.url}: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: response.headers.get('content-type') ?? undefined,
      };
    }
    default: {
      const neverSource: never = source;
      return neverSource;
    }
  }
}

function decodeAudio(buffer: Buffer, mimeType?: string): DecodedAudio {
  if (mimeType && mimeType.includes('wav')) {
    return decodeWav(buffer);
  }

  if (isWav(buffer)) {
    return decodeWav(buffer);
  }

  throw new Error(
    `Unsupported audio encoding ${mimeType ?? 'unknown'}; expected 16-bit PCM WAV for LiveKit streaming STT`,
  );
}
