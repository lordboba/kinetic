import { useState, useRef, useEffect, useCallback } from 'react';
import { getBackendEndpoint } from './env';

interface UseSpeechToTextOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseSpeechToTextReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  transcript: string | null;
}

export function useSpeechToText(options?: UseSpeechToTextOptions): UseSpeechToTextReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    const backendEndpoint = getBackendEndpoint();
    const wsEndpoint = backendEndpoint
      .replace('http://', 'ws://')
      .replace('https://', 'wss://')
      .replace(/\/$/, '');

    const wsUrl = `${wsEndpoint}/stt`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer'; // Handle binary data
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[STT] WebSocket connected');
      // Optionally send language preferences
      ws.send(JSON.stringify({
        language: 'en',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ready') {
          console.log('[STT] WebSocket ready');
        } else if (message.type === 'stt.options_updated') {
          console.log('[STT] Options updated:', message.options);
        } else if (message.type === 'stt.result') {
          console.log('[STT] Transcription received:', message.text);
          setTranscript(message.text);
          setIsProcessing(false);
          options?.onTranscript?.(message.text);
        } else if (message.type === 'stt.error') {
          console.error('[STT] Error:', message.message);
          setIsProcessing(false);
          options?.onError?.(message.message);
        }
      } catch (error) {
        console.error('[STT] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[STT] WebSocket error:', error);
      setIsProcessing(false);
      options?.onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('[STT] WebSocket closed');
    };
  }, [options]);

  // Analyze audio levels for visualization
  const analyzeAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average audio level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyzing audio levels
      analyzeAudioLevel();

      // Initialize WebSocket
      initializeWebSocket();

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[STT] Recording stopped, processing...');
        setIsProcessing(true);

        // Create audio blob and send as binary (much faster than base64!)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Send binary data directly to WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('[STT] Sending binary audio, size:', audioBlob.size);
          wsRef.current.send(audioBlob);
        } else {
          console.error('[STT] WebSocket not connected');
          setIsProcessing(false);
          options?.onError?.('WebSocket not connected');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('[STT] Recording started');
    } catch (error) {
      console.error('[STT] Failed to start recording:', error);
      options?.onError?.('Failed to access microphone');
    }
  }, [analyzeAudioLevel, initializeWebSocket, options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Stop audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      console.log('[STT] Recording stopped');
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    audioLevel,
    startRecording,
    stopRecording,
    transcript,
  };
}
