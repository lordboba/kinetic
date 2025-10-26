
'use client';

import React, { useState, useEffect } from 'react';
import { Slide } from '@/components/slides/Slide';
import { useSearchParams } from 'next/navigation';
import { getBackendEndpoint } from '@/lib/env';
import type { Lecture } from 'schema';

export default function MDXTestPage() {
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('id');

  const [currentSlide, setCurrentSlide] = useState(0);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // open websocket #2 connection to fetch lecture
  useEffect(() => {
    console.log('[WS2-Client] useEffect triggered', { lectureId });

    if (!lectureId) {
      console.warn('[WS2-Client] No lecture ID provided in URL');
      setError('No lecture ID provided. Add ?id=your-lecture-id to the URL.');
      setLoading(false);
      return;
    }

    let ws: WebSocket | null = null;

    const connectWebSocket = () => {
      try {
        const backendEndpoint = getBackendEndpoint();
        console.log('[WS2-Client] Backend endpoint:', backendEndpoint);

        // convert HTTP endpoint to WebSocket endpoint
        // backendEndpoint is already http://localhost:4000/api/
        const wsEndpoint = backendEndpoint
          .replace('http://', 'ws://')
          .replace('https://', 'wss://')
          .replace(/\/$/, ''); // Remove trailing slash

        // Don't add /api/ again since backendEndpoint already includes it
        const wsUrl = `${wsEndpoint}/lecture?lecture_id=${lectureId}`;

        console.log('[WS2-Client] Connecting to WebSocket:', {
          originalEndpoint: backendEndpoint,
          wsEndpoint,
          fullUrl: wsUrl,
          lectureId
        });

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS2-Client] WebSocket connection opened successfully', {
            readyState: ws?.readyState,
            url: wsUrl
          });
        };

        ws.onmessage = (event) => {
          console.log('[WS2-Client] Message received from server', {
            dataType: typeof event.data,
            dataLength: event.data.length,
            rawData: event.data.substring(0, 200) + '...' // First 200 chars
          });

          try {
            const response = JSON.parse(event.data) as {
              success: boolean;
              lecture?: Lecture;
              error?: string;
            };

            console.log('[WS2-Client] Parsed response:', {
              success: response.success,
              hasLecture: !!response.lecture,
              error: response.error,
              slideCount: response.lecture?.slides?.length
            });

            if (!response.success) {
              console.error('[WS2-Client] Server returned error:', response.error);
              setError(response.error || 'Failed to fetch lecture');
              setLoading(false);
              return;
            }

            if (response.lecture) {
              console.log('[WS2-Client] Lecture received successfully:', {
                version: response.lecture.version,
                slideCount: response.lecture.slides?.length,
                permittedUsers: response.lecture.permitted_users,
                slides: response.lecture.slides?.map((slide, idx) => ({
                  index: idx,
                  title: slide.title,
                  hasContent: !!slide.content,
                  hasDiagram: !!slide.diagram,
                  hasImage: !!slide.image,
                  hasVoiceover: !!slide.audio_transcription_link,
                  hasQuestion: !!slide.question,
                  contentLength: slide.content?.length || 0,
                  transcriptLength: slide.transcript?.length || 0
                }))
              });

              setLecture(response.lecture);
              setLoading(false);
              setError(null);
              console.log('[WS2-Client] State updated - lecture set, loading complete');
            } else {
              console.warn('[WS2-Client] Success response but no lecture data');
            }
          } catch (err) {
            console.error('[WS2-Client] Error parsing WebSocket message:', {
              error: err,
              message: err instanceof Error ? err.message : 'Unknown error',
              stack: err instanceof Error ? err.stack : undefined,
              rawData: event.data
            });
            setError('Failed to parse lecture data');
            setLoading(false);
          }
        };

        ws.onerror = (event) => {
          console.error('[WS2-Client] WebSocket error occurred:', {
            event,
            readyState: ws?.readyState,
            url: wsUrl,
            type: event.type
          });
          setError('WebSocket connection error. Check console for details.');
          setLoading(false);
        };

        ws.onclose = (event) => {
          console.log('[WS2-Client] WebSocket connection closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: wsUrl
          });
        };
      } catch (err) {
        console.error('[WS2-Client] Error setting up WebSocket:', {
          error: err,
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        });
        setError(err instanceof Error ? err.message : 'Failed to connect to WebSocket');
        setLoading(false);
      }
    };

    connectWebSocket();

    // cleanup on unmount
    return () => {
      console.log('[WS2-Client] Cleaning up WebSocket connection');
      if (ws) {
        console.log('[WS2-Client] Closing WebSocket on unmount', {
          readyState: ws.readyState
        });
        ws.close();
      }
    };
  }, [lectureId]);

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

  const nextSlide = () => {
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

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Slide Display - Takes remaining space */}
      <div className="flex-1 overflow-hidden relative">
        <Slide lectureSlides={lecture.slides} i={currentSlide} />

        {/* Present Button - Floating */}
        <button
          onClick={openPresentation}
          className="absolute top-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg font-medium text-sm flex items-center gap-2"
        >
          <span>🎬</span> Open Presentation Mode
        </button>
      </div>

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
            {lecture.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide
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
            disabled={currentSlide === lecture.slides.length - 1}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            Next →
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
      </div>

    </div>
  );
}
