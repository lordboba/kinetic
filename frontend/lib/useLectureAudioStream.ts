'use client';

import { useCallback, useRef, useState } from 'react';
import type { SlideAudioBuffer, SlideAudioStatus } from 'schema/zod_types';
import type { BinarySlideAudioChunk } from './audioStreamProtocol';

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

export function useLectureAudioStream() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const slidePlaybackRef = useRef<Record<number, SlidePlaybackState>>({});
  const activeSourcesRef = useRef<Map<number, Set<AudioBufferSourceNode>>>(new Map());

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

  const stopSlideSources = useCallback((slideIndex: number) => {
    const sources = activeSourcesRef.current.get(slideIndex);
    if (!sources) {
      return;
    }
    for (const source of sources) {
      try {
        source.stop();
      } catch (error) {
        console.warn('[useLectureAudioStream] Failed to stop source', error);
      }
    }
    sources.clear();
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
        if (!activeSourcesRef.current.has(slideIndex)) {
          activeSourcesRef.current.set(slideIndex, new Set());
        }
        const slideSources = activeSourcesRef.current.get(slideIndex)!;
        slideSources.add(source);
        source.onended = () => {
          slideSources.delete(source);
          if (slideSources.size === 0) {
            activeSourcesRef.current.delete(slideIndex);
          }
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
    (chunk: BinarySlideAudioChunk) => {
      const { ctx } = ensureGraph();
      if (!ctx) {
        return;
      }

      if (chunk.samplesPerChannel <= 0 || chunk.channels <= 0) {
        console.warn('[useLectureAudioStream] Invalid chunk metadata', chunk);
        return;
      }

      const expectedSamples = chunk.samplesPerChannel * chunk.channels;
      if (chunk.pcm16.length !== expectedSamples) {
        console.warn('[useLectureAudioStream] Unexpected PCM payload length', {
          expectedSamples,
          received: chunk.pcm16.length,
        });
        return;
      }

      const buffer = ctx.createBuffer(chunk.channels, chunk.samplesPerChannel, chunk.sampleRate);
      for (let channel = 0; channel < chunk.channels; channel += 1) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < chunk.samplesPerChannel; i += 1) {
          const sampleIndex = i * chunk.channels + channel;
          channelData[i] = Math.max(-1, Math.min(1, chunk.pcm16[sampleIndex]! / PCM_MAX_VALUE));
        }
      }

      const state = ensureSlideState(chunk.slideIndex);
      state.queue.push({ buffer, duration: buffer.duration });
      state.pendingDuration += buffer.duration;

      if (!state.started) {
        const shouldStart = state.pendingDuration >= MIN_INITIAL_BUFFER_SEC;
        state.started = shouldStart;
        state.nextStartTime = ctx.currentTime;
        updateSnapshot(chunk.slideIndex, {
          mode: 'streaming',
          bufferedSeconds: state.pendingDuration,
          isBuffering: !shouldStart,
          lastChunkIndex: chunk.chunkIndex,
        });
        if (shouldStart) {
          setStreamingSlide(chunk.slideIndex);
          schedulePendingChunks(chunk.slideIndex);
        }
      } else {
        schedulePendingChunks(chunk.slideIndex);
        updateSnapshot(chunk.slideIndex, { lastChunkIndex: chunk.chunkIndex });
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
        stopSlideSources(status.slide_index);
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
    [ensureSlideState, stopSlideSources, updateSnapshot],
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
