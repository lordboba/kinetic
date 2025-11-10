'use client';

import { useCallback, useRef, useState } from 'react';
import type { Buffer } from 'buffer';
import type { SlideAudioBuffer, SlideAudioChunk, SlideAudioStatus } from 'schema/zod_types';

const PCM_MAX_VALUE = 32768;
const MIN_INITIAL_BUFFER_SEC = 2.5;
const MIN_CONTINUOUS_BUFFER_SEC = 1.5;

type SlidePlaybackState = {
  queue: Array<{ buffer: AudioBuffer; duration: number }>;
  pendingDuration: number;
  started: boolean;
  nextStartTime: number;
  isComplete: boolean;
};

export type SlideStreamSnapshot = {
  mode: 'streaming';
  bufferedSeconds: number;
  isBuffering: boolean;
  readyToAdvance: boolean;
  isComplete: boolean;
  lastChunkIndex: number;
};

function decodePcm16(base64: string): Int16Array {
  const binary = typeof atob === 'function'
    ? atob(base64)
    : typeof globalThis !== 'undefined' && typeof (globalThis as { Buffer?: typeof Buffer }).Buffer !== 'undefined'
      ? (globalThis as { Buffer?: typeof Buffer }).Buffer!.from(base64, 'base64').toString('binary')
      : '';
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i += 1) {
    view[i] = binary.charCodeAt(i);
  }
  return new Int16Array(buffer);
}

export function useLectureAudioStream() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const slidePlaybackRef = useRef<Record<number, SlidePlaybackState>>({});
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const [streamingSlide, setStreamingSlide] = useState<number | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [streamingState, setStreamingState] = useState<Record<number, SlideStreamSnapshot>>({});

  const ensureGraph = useCallback(() => {
    if (typeof window === 'undefined') {
      return { ctx: null as AudioContext | null, destination: null as MediaStreamAudioDestinationNode | null };
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (!destinationRef.current && audioContextRef.current) {
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      setMediaStream(destinationRef.current.stream);
    }

    return { ctx: audioContextRef.current, destination: destinationRef.current };
  }, []);

  const stopAllSources = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch (error) {
        console.warn('[useLectureAudioStream] Failed to stop source', error);
      }
    }
    activeSourcesRef.current.clear();
  }, []);

  const ensureSlideState = useCallback(
    (slideIndex: number): SlidePlaybackState => {
      if (!slidePlaybackRef.current[slideIndex]) {
        slidePlaybackRef.current[slideIndex] = {
          queue: [],
          pendingDuration: 0,
          started: false,
          nextStartTime: 0,
          isComplete: false,
        };
      }
      return slidePlaybackRef.current[slideIndex]!;
    },
    [],
  );

  const updateSnapshot = useCallback((slideIndex: number, patch: Partial<SlideStreamSnapshot>) => {
    setStreamingState((prev) => {
      const existing = prev[slideIndex];
      const next: SlideStreamSnapshot = {
        mode: 'streaming',
        bufferedSeconds: existing?.bufferedSeconds ?? 0,
        isBuffering: existing?.isBuffering ?? true,
        readyToAdvance: existing?.readyToAdvance ?? false,
        isComplete: existing?.isComplete ?? false,
        lastChunkIndex: existing?.lastChunkIndex ?? 0,
        ...patch,
      };
      return { ...prev, [slideIndex]: next };
    });
  }, []);

  const schedulePendingChunks = useCallback(
    (slideIndex: number) => {
      const { ctx, destination } = ensureGraph();
      if (!ctx || !destination) {
        return;
      }

      const state = ensureSlideState(slideIndex);
      while (state.queue.length > 0) {
        const { buffer, duration } = state.queue.shift()!;
        state.pendingDuration = Math.max(state.pendingDuration - duration, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);

        const now = ctx.currentTime;
        const startAt = Math.max(state.nextStartTime, now + 0.02);
        source.start(startAt);
        state.nextStartTime = startAt + duration;
        activeSourcesRef.current.add(source);
        source.onended = () => {
          activeSourcesRef.current.delete(source);
        };
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch((error) => {
          console.warn('[useLectureAudioStream] Failed to resume AudioContext', error);
        });
      }

      const bufferedAhead = state.started
        ? Math.max(state.nextStartTime - (ctx?.currentTime ?? 0), 0)
        : state.pendingDuration;
      updateSnapshot(slideIndex, {
        bufferedSeconds: bufferedAhead,
        isBuffering: !state.started || (bufferedAhead < MIN_CONTINUOUS_BUFFER_SEC && !state.isComplete),
      });
    },
    [ensureGraph, ensureSlideState, updateSnapshot],
  );

  const handleChunk = useCallback(
    (chunk: SlideAudioChunk) => {
      const { ctx } = ensureGraph();
      if (!ctx) {
        return;
      }

      if (chunk.samples_per_channel <= 0 || chunk.channels <= 0) {
        console.warn('[useLectureAudioStream] Invalid chunk metadata', chunk);
        return;
      }

      const samples = decodePcm16(chunk.pcm16_base64);
      const expectedSamples = chunk.samples_per_channel * chunk.channels;
      if (samples.length !== expectedSamples) {
        console.warn('[useLectureAudioStream] Unexpected PCM payload length', {
          expectedSamples,
          received: samples.length,
        });
        return;
      }

      const buffer = ctx.createBuffer(chunk.channels, chunk.samples_per_channel, chunk.sample_rate);
      for (let channel = 0; channel < chunk.channels; channel += 1) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < chunk.samples_per_channel; i += 1) {
          const sampleIndex = i * chunk.channels + channel;
          channelData[i] = Math.max(-1, Math.min(1, samples[sampleIndex]! / PCM_MAX_VALUE));
        }
      }

      const state = ensureSlideState(chunk.slide_index);
      state.queue.push({ buffer, duration: buffer.duration });
      state.pendingDuration += buffer.duration;

      if (!state.started) {
        const shouldStart = state.pendingDuration >= MIN_INITIAL_BUFFER_SEC;
        state.started = shouldStart;
        state.nextStartTime = ctx.currentTime;
        updateSnapshot(chunk.slide_index, {
          mode: 'streaming',
          bufferedSeconds: state.pendingDuration,
          isBuffering: !shouldStart,
          lastChunkIndex: chunk.chunk_index,
        });
        if (shouldStart) {
          setStreamingSlide(chunk.slide_index);
          schedulePendingChunks(chunk.slide_index);
        }
      } else {
        schedulePendingChunks(chunk.slide_index);
        updateSnapshot(chunk.slide_index, { lastChunkIndex: chunk.chunk_index });
      }
    },
    [ensureGraph, ensureSlideState, schedulePendingChunks, updateSnapshot],
  );

  const handleStatus = useCallback(
    (status: SlideAudioStatus) => {
      if (status.status === 'started') {
        const state = ensureSlideState(status.slide_index);
        state.started = false;
        state.pendingDuration = 0;
        state.queue = [];
        state.nextStartTime = audioContextRef.current?.currentTime ?? 0;
        state.isComplete = false;
        stopAllSources();
        updateSnapshot(status.slide_index, {
          bufferedSeconds: 0,
          isBuffering: true,
          readyToAdvance: false,
          isComplete: false,
        });
        return;
      }

      if (status.status === 'completed') {
        const state = ensureSlideState(status.slide_index);
        state.isComplete = true;
        updateSnapshot(status.slide_index, {
          isComplete: true,
          readyToAdvance: true,
          isBuffering: false,
        });
        return;
      }

      if (status.status === 'error') {
        updateSnapshot(status.slide_index, {
          isBuffering: false,
          readyToAdvance: true,
        });
      }
    },
    [ensureSlideState, stopAllSources, updateSnapshot],
  );

  const handleBufferUpdate = useCallback(
    (buffer: SlideAudioBuffer) => {
      updateSnapshot(buffer.slide_index, {
        bufferedSeconds: buffer.buffered_ms / 1000,
        readyToAdvance: buffer.ready_to_advance ?? false,
        isComplete: buffer.is_complete ?? false,
        lastChunkIndex: buffer.chunk_index,
        isBuffering: !(buffer.ready_to_advance ?? false) && !(buffer.is_complete ?? false),
      });
    },
    [updateSnapshot],
  );

  return {
    mediaStream,
    streamingSlide,
    streamingState,
    handleChunk,
    handleStatus,
    handleBufferUpdate,
  };
}
