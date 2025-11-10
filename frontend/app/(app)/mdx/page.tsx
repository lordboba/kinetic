
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Slide } from '@/components/slides/Slide';
import { useSearchParams } from 'next/navigation';
import { getBackendEndpoint } from '@/lib/env';
import { useLectureAudioStream } from '@/lib/useLectureAudioStream';
import type { LectureSlide, Lecture } from 'schema';
import {
  ZGetLectureRequest,
  ZGetLectureResponse,
  ZUserQuestionRequest,
  ZUserQuestionResponse,
  ZBackendQuestionRequest,
  ZOutboundMessage,
  ZSlideAudioChunk,
  ZSlideAudioStatus,
  ZSlideAudioBuffer,
  type GetLectureResponse,
  type UserQuestionResponse,
  type BackendQuestionRequest,
  type SlideAudioChunk,
  type SlideAudioStatus,
  type SlideAudioBuffer,
} from 'schema/zod_types';

type ClientPhase = 'disconnected' | 'connecting' | 'awaiting_lecture' | 'ready';

interface UseLectureChannelOptions {
  onAudioChunk?: (chunk: SlideAudioChunk) => void;
  onAudioStatus?: (status: SlideAudioStatus) => void;
  onAudioBuffer?: (buffer: SlideAudioBuffer) => void;
  enableStreamingAudio?: boolean;
}

interface UseLectureChannelReturn {
  phase: ClientPhase;
  lecture: GetLectureResponse['lecture'] | null;
  lastAnswer: UserQuestionResponse | null;
  lastBackendQuestion: BackendQuestionRequest | null;
  askQuestion: (slide: number, question: string) => void;
}

function useLectureChannel(lectureId: string, options?: UseLectureChannelOptions): UseLectureChannelReturn {
  const [phase, setPhase] = useState<ClientPhase>('disconnected');
  const [lecture, setLecture] = useState<GetLectureResponse['lecture'] | null>(null);
  const [lastAnswer, setLastAnswer] = useState<UserQuestionResponse | null>(null);
  const [lastBackendQuestion, setLastBackendQuestion] = useState<BackendQuestionRequest | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Construct WebSocket URL
    const backendEndpoint = getBackendEndpoint();
    const wsEndpoint = backendEndpoint
      .replace('http://', 'ws://')
      .replace('https://', 'wss://')
      .replace(/\/$/, '');

    const wsUrl = `${wsEndpoint}/watch_lecture`;

    console.log('[useLectureChannel] Connecting to:', wsUrl);

    // Create WebSocket and move to connecting
    setPhase('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useLectureChannel] WebSocket opened');

      // Construct and validate init message
      const initMessage: {
        type: 'get_lecture_request';
        lecture_id: string;
        capabilities?: { audio_streaming?: boolean };
      } = {
        type: 'get_lecture_request' as const,
        lecture_id: lectureId,
      };

      if (optionsRef.current?.enableStreamingAudio) {
        initMessage.capabilities = { audio_streaming: true };
      }

      const validationResult = ZGetLectureRequest.safeParse(initMessage);
      if (!validationResult.success) {
        console.error('[useLectureChannel] Failed to construct valid GetLectureRequest:', validationResult.error);
        ws.close();
        setPhase('disconnected');
        return;
      }

      // Send init message
      console.log('[useLectureChannel] Sending init message:', validationResult.data);
      ws.send(JSON.stringify(validationResult.data));
      setPhase('awaiting_lecture');
    };

    ws.onmessage = (event) => {
      console.log('[useLectureChannel] Message received:', event.data);

      try {
        const parsed = JSON.parse(event.data);
        const validationResult = ZOutboundMessage.safeParse(parsed);

        if (!validationResult.success) {
          console.error('[useLectureChannel] Received invalid message from server:', validationResult.error);
          return;
        }

        const message = validationResult.data;
        console.log('[useLectureChannel] Valid message type:', message.type);

        switch (message.type) {
          case 'get_lecture_response': {
            const lectureValidation = ZGetLectureResponse.safeParse(message);
            if (!lectureValidation.success) {
              console.error('[useLectureChannel] Invalid get_lecture_response:', lectureValidation.error);
              return;
            }
            console.log('[useLectureChannel] Lecture received, transitioning to ready');
            setLecture(lectureValidation.data.lecture);
            setPhase('ready');
            break;
          }

          case 'user_question_response': {
            const answerValidation = ZUserQuestionResponse.safeParse(message);
            if (!answerValidation.success) {
              console.error('[useLectureChannel] Invalid user_question_response:', answerValidation.error);
              return;
            }
            console.log('[useLectureChannel] User question response received');
            setLastAnswer(answerValidation.data);

            // If partial lecture update is included, merge the new slides
            if (answerValidation.data.partial_lecture) {
              console.log('[useLectureChannel] Partial lecture update detected, updating slides');
              setLecture((prevLecture) => {
                if (!prevLecture) return prevLecture;

                const { from_slide, slides: newSlides } = answerValidation.data.partial_lecture!;
                const updatedSlides = [
                  ...prevLecture.slides.slice(0, from_slide),
                  ...newSlides,
                ];

                console.log(`[useLectureChannel] Updated lecture with ${newSlides.length} new slides from slide ${from_slide}`);

                return {
                  ...prevLecture,
                  slides: updatedSlides,
                };
              });
            }
            break;
          }

          case 'slide_audio_chunk': {
            const chunkValidation = ZSlideAudioChunk.safeParse(message);
            if (!chunkValidation.success) {
              console.error('[useLectureChannel] Invalid slide_audio_chunk:', chunkValidation.error);
              return;
            }
            optionsRef.current?.onAudioChunk?.(chunkValidation.data);
            break;
          }

          case 'slide_audio_status': {
            const statusValidation = ZSlideAudioStatus.safeParse(message);
            if (!statusValidation.success) {
              console.error('[useLectureChannel] Invalid slide_audio_status:', statusValidation.error);
              return;
            }

            const status = statusValidation.data;
            if (status.status === 'completed' && status.audio_url) {
              setLecture((prev) => {
                if (!prev) return prev;
                if (!prev.slides?.[status.slide_index]) return prev;
                const nextSlides = [...prev.slides];
                nextSlides[status.slide_index] = {
                  ...nextSlides[status.slide_index],
                  audio_transcription_link: status.audio_url,
                } as LectureSlide;
                return { ...prev, slides: nextSlides };
              });
            }

            optionsRef.current?.onAudioStatus?.(status);
            break;
          }

          case 'slide_audio_buffer': {
            const bufferValidation = ZSlideAudioBuffer.safeParse(message);
            if (!bufferValidation.success) {
              console.error('[useLectureChannel] Invalid slide_audio_buffer:', bufferValidation.error);
              return;
            }
            optionsRef.current?.onAudioBuffer?.(bufferValidation.data);
            break;
          }

          // case 'backend_question': {
          //   const backendQuestionValidation = ZBackendQuestionRequest.safeParse(message);
          //   if (!backendQuestionValidation.success) {
          //     console.error('[useLectureChannel] Invalid backend_question:', backendQuestionValidation.error);
          //     return;
          //   }
          //   console.log('[useLectureChannel] Backend question received');
          //   setLastBackendQuestion(backendQuestionValidation.data);
          //   break;
          // }
        }
      } catch (error) {
        console.error('[useLectureChannel] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[useLectureChannel] WebSocket error:', error);
      setPhase('disconnected');
    };

    ws.onclose = () => {
      console.log('[useLectureChannel] WebSocket closed');
      setPhase('disconnected');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [lectureId]);

  const askQuestion = (slide: number, question: string) => {
    // Only send if ready and socket is open
    if (phase !== 'ready') {
      console.warn('[useLectureChannel] Cannot ask question: phase is not ready');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[useLectureChannel] Cannot ask question: WebSocket not open');
      return;
    }

    // Construct and validate user question
    const questionMessage = {
      type: 'user_question_request' as const,
      lecture_id: lectureId,
      current_slide: slide,
      question,
    };

    const validationResult = ZUserQuestionRequest.safeParse(questionMessage);
    if (!validationResult.success) {
      console.error('[useLectureChannel] Failed to construct valid UserQuestionRequest:', validationResult.error);
      return;
    }

    // Send question
    console.log('[useLectureChannel] Sending user question:', validationResult.data);
    wsRef.current.send(JSON.stringify(validationResult.data));
  };

  return {
    phase,
    lecture,
    lastAnswer,
    lastBackendQuestion,
    askQuestion,
  };
}

export default function MDXTestPage() {
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('id');

  const [currentSlide, setCurrentSlide] = useState(0);
  const [questionText, setQuestionText] = useState('');
  const [isAnswerPanelMinimized, setIsAnswerPanelMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ENABLE_STREAMING_AUDIO = true;

  const {
    mediaStream,
    streamingSlide,
    streamingState,
    handleChunk: handleAudioChunk,
    handleStatus: handleAudioStatus,
    handleBufferUpdate: handleAudioBuffer,
  } = useLectureAudioStream();

  const lectureChannelOptions = useMemo<UseLectureChannelOptions>(
    () => ({
      onAudioChunk: handleAudioChunk,
      onAudioStatus: handleAudioStatus,
      onAudioBuffer: handleAudioBuffer,
      enableStreamingAudio: ENABLE_STREAMING_AUDIO,
    }),
    [handleAudioChunk, handleAudioStatus, handleAudioBuffer]
  );

  // Use the new state machine hook
  const { phase, lecture, lastAnswer, lastBackendQuestion, askQuestion } =
    useLectureChannel(lectureId || '', lectureChannelOptions);

  // Derive loading and error states from phase
  const loading = phase === 'connecting' || phase === 'awaiting_lecture';
  const error = !lectureId
    ? 'No lecture ID provided. Add ?id=your-lecture-id to the URL.'
    : phase === 'disconnected' && !lecture
      ? 'Failed to connect to server. Please try again.'
      : null;

  // keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lecture) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, lecture]);

  useEffect(() => {
    if (!lecture) {
      return;
    }

    const slide = lecture.slides[currentSlide];
    const audioEl = audioRef.current;

    if (!audioEl) {
      return;
    }

    const handleEnded = () => {
      setCurrentSlide((prev) => {
        const lastIndex = lecture.slides.length - 1;
        return prev < lastIndex ? prev + 1 : prev;
      });
    };

    audioEl.addEventListener('ended', handleEnded);

    const currentStreamingInfo = streamingState[currentSlide];
    const useStreamingForSlide = ENABLE_STREAMING_AUDIO && currentStreamingInfo?.mode === 'streaming';
    const isStreamingCurrentSlide = useStreamingForSlide && streamingSlide === currentSlide && mediaStream;

    if (isStreamingCurrentSlide && mediaStream) {
      if (audioEl.srcObject !== mediaStream) {
        audioEl.srcObject = mediaStream;
        audioEl.removeAttribute('src');
        audioEl.currentTime = 0;
      }

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('[MDXTestPage] Autoplay prevented for stream:', error);
        });
      }

      return () => {
        audioEl.pause();
        audioEl.removeEventListener('ended', handleEnded);
      };
    }

    if (audioEl.srcObject) {
      audioEl.srcObject = null;
    }

    if (slide?.audio_transcription_link) {
      audioEl.src = slide.audio_transcription_link;
      audioEl.currentTime = 0;

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('[MDXTestPage] Autoplay prevented:', error);
        });
      }
    } else {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }

    return () => {
      audioEl.pause();
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [lecture, currentSlide, streamingSlide, mediaStream, streamingState]);

  const streamingInfo = streamingState[currentSlide];
  const streamingMode = ENABLE_STREAMING_AUDIO && streamingInfo?.mode === 'streaming';
  const navigationLocked = streamingMode && !streamingInfo?.readyToAdvance;
  const streamingBufferSeconds = streamingInfo?.bufferedSeconds ?? 0;

  const nextSlide = () => {
    if (navigationLocked) {
      return;
    }
    if (lecture && currentSlide < lecture.slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    if (navigationLocked && index > currentSlide) {
      return;
    }
    setCurrentSlide(index);
  };

  const openPresentation = () => {
    window.open(`/present?id=${lectureId}`, '_blank', 'width=1200,height=800');
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lecture...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Lecture</h1>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No lecture data
  if (!lecture || !lecture.slides || lecture.slides.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600">No lecture data available</p>
        </div>
      </div>
    );
  }

  const currentSlideData = lecture.slides[currentSlide];
  const isStreamingCurrentSlide = streamingMode && streamingSlide === currentSlide;
  const hasAudio = isStreamingCurrentSlide || Boolean(currentSlideData.audio_transcription_link);

  const handleAskQuestion = () => {
    if (questionText.trim() && phase === 'ready') {
      askQuestion(currentSlide, questionText);
      setQuestionText('');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Slide Display - Takes remaining space */}
      <div className="flex-1 overflow-hidden relative">
        <Slide lectureSlides={lecture.slides} i={currentSlide} />

        {ENABLE_STREAMING_AUDIO && streamingMode && streamingInfo?.isBuffering && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 text-white text-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 border-2 border-white/60 border-t-transparent rounded-full animate-spin" aria-hidden />
              <p className="font-semibold">Buffering narration…</p>
              <p className="text-xs text-white/80">
                {Math.max(0, streamingBufferSeconds).toFixed(1)}s buffered
              </p>
            </div>
          </div>
        )}

        {/* Present Button - Floating */}
        <button
          onClick={openPresentation}
          className="absolute top-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg font-medium text-sm flex items-center gap-2"
        >
          <span>🎬</span> Open Presentation Mode
        </button>

        {/* Connection Status Indicator - Floating */}
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-white rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${phase === 'ready'
                ? 'bg-green-500'
                : phase === 'disconnected'
                  ? 'bg-red-500'
                  : 'bg-yellow-500 animate-pulse'
              }`}
          />
          <span className="text-gray-700">
            {phase === 'ready'
              ? 'Connected'
              : phase === 'disconnected'
                ? 'Disconnected'
                : phase === 'connecting'
                  ? 'Connecting...'
                  : 'Loading lecture...'}
          </span>
        </div>
      </div>

      {/* Question/Answer Panel - Conditionally rendered */}
      {(lastAnswer || lastBackendQuestion) && (
        <div className="bg-white border-t border-gray-300">
          {/* Header with minimize button */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">AI Response</h3>
            <button
              onClick={() => setIsAnswerPanelMinimized(!isAnswerPanelMinimized)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label={isAnswerPanelMinimized ? 'Expand response' : 'Minimize response'}
              title={isAnswerPanelMinimized ? 'Expand response' : 'Minimize response'}
            >
              <svg
                className="w-5 h-5 text-gray-600 transition-transform"
                style={{ transform: isAnswerPanelMinimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Panel content - conditionally shown */}
          {!isAnswerPanelMinimized && (
            <div className="p-4 max-h-48 overflow-y-auto">
              {/* Last Answer from User Question */}
              {lastAnswer && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 text-sm mb-1">
                    {lastAnswer.partial_lecture ? 'Lecture Regenerated:' : 'Answer:'}
                  </h4>
                  <p className="text-green-800 text-sm">{lastAnswer.response.response}</p>
                  {lastAnswer.partial_lecture && (
                    <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-700">
                      <p className="font-semibold mb-1">✨ Slides have been regenerated!</p>
                      <p>
                        Added {lastAnswer.partial_lecture.slides.length} new slide{lastAnswer.partial_lecture.slides.length !== 1 ? 's' : ''} starting from slide {lastAnswer.partial_lecture.from_slide + 1}.
                        The lecture has been updated based on your question.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Backend Question */}
              {lastBackendQuestion && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 text-sm mb-1">
                    Check-in Question (Slide {lastBackendQuestion.current_slide + 1}):
                  </h4>
                  <p className="text-blue-800 text-sm mb-2">{lastBackendQuestion.question}</p>
                  <p className="text-xs text-blue-600">
                    <strong>Your answer:</strong> {lastBackendQuestion.answer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audio Playback */}
      <div className="bg-white border-t border-gray-300 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            <p className="uppercase tracking-wide text-xs font-semibold text-gray-500">
              Slide narration
            </p>
            <p className="font-medium text-gray-900">
              Slide {currentSlide + 1}: {currentSlideData.title}
            </p>
            <p className="text-xs text-gray-500">
              {isStreamingCurrentSlide
                ? 'Streaming narration in progress. Audio will finalize shortly.'
                : hasAudio
                  ? 'Auto-playing audio narration. Advance manually at any time.'
                  : 'No audio narration available for this slide.'}
            </p>
            {streamingMode && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <div
                  className={`h-3 w-3 rounded-full ${streamingInfo?.isBuffering ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}
                />
                <span className="text-gray-600">
                  {streamingInfo?.isBuffering
                    ? `Buffering… ${streamingBufferSeconds.toFixed(1)}s ready`
                    : 'Buffered and ready to advance'}
                </span>
              </div>
            )}
          </div>
          <audio
            ref={audioRef}
            controls
            className="w-full sm:w-auto"
            aria-label="Slide audio narration"
          />
        </div>
      </div>

      {/* Question Input - Fixed above navigation */}
      {phase === 'ready' && (
        <div className="bg-gray-100 border-t border-gray-300 p-3">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAskQuestion();
                }
              }}
              placeholder={`Ask a question about slide ${currentSlide + 1}...`}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={phase !== 'ready'}
            />
            <button
              onClick={handleAskQuestion}
              disabled={!questionText.trim() || phase !== 'ready'}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              Ask
            </button>
          </div>
        </div>
      )}

      {/* Navigation Controls - Fixed height at bottom */}
      <div className="bg-gray-800 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Previous Button */}
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            ← Previous
          </button>

          {/* Slide Indicators */}
          <div className="flex items-center gap-2">
            {lecture.slides.map((_: LectureSlide, index: number) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${index === currentSlide
                    ? 'bg-blue-500 w-8'
                    : 'bg-gray-500 hover:bg-gray-400'
                  }`}
                aria-label={`Go to slide ${index + 1}`}
                title={lecture.slides[index].title}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={nextSlide}
            disabled={navigationLocked || currentSlide === lecture.slides.length - 1}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            title={navigationLocked ? 'Waiting for narration to buffer' : 'Go to next slide'}
          >
            {navigationLocked ? 'Buffering…' : 'Next →'}
          </button>
        </div>

        {/* Slide Counter and Help Text */}
        <div className="max-w-6xl mx-auto mt-2 flex justify-between items-center text-sm text-gray-400">
          <div>
            Use keyboard: <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd>{' '}
            <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd> to navigate
          </div>
          <div className="font-medium">
            Slide {currentSlide + 1} of {lecture.slides.length}
          </div>
        </div>
        {navigationLocked && (
          <div className="max-w-6xl mx-auto mt-2 text-xs text-yellow-300">
            Narration is still buffering. Please wait a moment before advancing.
          </div>
        )}
      </div>
    </div>
  );
}
