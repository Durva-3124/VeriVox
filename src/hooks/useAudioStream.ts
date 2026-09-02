import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_CHUNK_OVERLAP,
  AUDIO_CHUNK_SAMPLES,
  DEFAULT_STREAM_WS_URL,
  createAudioChunkMessage,
  createAudioChunks,
  resampleTo16kHzMono,
  type AudioChunkPayload,
} from '../utils/audioChunk';

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'stopped' | 'error';

export interface AudioStreamMessage {
  type?: string;
  [key: string]: unknown;
}

export interface UseAudioStreamOptions {
  wsUrl?: string;
  sessionId?: string;
  claimedVoiceprintId?: string;
  carrierOrigin?: string;
  sampleRate?: number;
  onMessage?: (message: AudioStreamMessage) => void;
  onError?: (error: Error | Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

const DEFAULT_SAMPLE_RATE = 16000;

export function useAudioStream(options: UseAudioStreamOptions = {}) {
  const {
    wsUrl = DEFAULT_STREAM_WS_URL,
    sessionId = `sess_${Date.now()}`,
    claimedVoiceprintId = 'VP-IND-MUM-88412',
    carrierOrigin = 'browser-mic',
    sampleRate = DEFAULT_SAMPLE_RATE,
    onMessage,
    onError,
    onOpen,
    onClose,
  } = options;

  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<AudioStreamMessage[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const audioContextReadyRef = useRef(false);

  const connectSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setStatus('connected');
      setError(null);
      onOpen?.();
    };

    ws.onmessage = (event) => {
      let parsed: AudioStreamMessage;

      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as unknown as AudioStreamMessage);
      } catch {
        parsed = { raw: String(event.data) };
      }

      setMessages((prev) => [parsed, ...prev].slice(0, 25));
      onMessage?.(parsed);
    };

    ws.onerror = (event) => {
      const nextError = event instanceof Error ? event : new Error('WebSocket error');
      setError(nextError);
      setStatus('error');
      onError?.(nextError);
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === 'recording' ? 'stopped' : prev));
      socketRef.current = null;
      onClose?.();
    };

    socketRef.current = ws;
    return ws;
  }, [onClose, onError, onMessage, onOpen, wsUrl]);

  const sendChunk = useCallback((chunk: Float32Array) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload: AudioChunkPayload = createAudioChunkMessage({
      sessionId,
      claimedVoiceprintId,
      carrierOrigin,
      sampleRate,
      chunk,
    });

    socketRef.current.send(JSON.stringify(payload));
  }, [carrierOrigin, claimedVoiceprintId, sampleRate, sessionId]);

  const flushAudioBuffer = useCallback(() => {
    if (audioBufferRef.current.length === 0 || !socketRef.current) {
      return;
    }

    const combined = new Float32Array(audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of audioBufferRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const mono = resampleTo16kHzMono(combined, sampleRate);
    const chunks = createAudioChunks(mono, AUDIO_CHUNK_SAMPLES, AUDIO_CHUNK_OVERLAP);
    for (const chunk of chunks) {
      sendChunk(chunk);
    }

    audioBufferRef.current = [];
  }, [sampleRate, sendChunk]);

  const stopMicrophone = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioBufferRef.current = [];
    isRecordingRef.current = false;
    setStatus('stopped');
  }, []);

  const stop = useCallback(() => {
    stopMicrophone();

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, [stopMicrophone]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    try {
      const ws = connectSocket();
      if (ws.readyState !== WebSocket.OPEN) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('WebSocket connection timed out')), 10000);
          const prevOnOpen = ws.onopen;
          const prevOnError = ws.onerror;

          ws.onopen = () => {
            window.clearTimeout(timeout);
            if (prevOnOpen) prevOnOpen.call(ws);
            resolve();
          };

          ws.onerror = (event) => {
            window.clearTimeout(timeout);
            if (prevOnError) prevOnError.call(ws, event);
            reject(new Error('Failed to open WebSocket connection'));
          };
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      audioContextReadyRef.current = true;

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const timeDomainData = new Float32Array(bufferLength);
      const processFrame = () => {
        if (!isRecordingRef.current || !analyserRef.current || !audioContextRef.current) {
          return;
        }

        analyserRef.current.getFloatTimeDomainData(timeDomainData);
        const mono = new Float32Array(timeDomainData.length);
        for (let i = 0; i < timeDomainData.length; i += 1) {
          mono[i] = timeDomainData[i];
        }

        audioBufferRef.current.push(mono);

        const totalSamples = audioBufferRef.current.reduce((sum, block) => sum + block.length, 0);
        if (totalSamples >= AUDIO_CHUNK_SAMPLES) {
          const combined = new Float32Array(totalSamples);
          let offset = 0;
          for (const block of audioBufferRef.current) {
            combined.set(block, offset);
            offset += block.length;
          }

          const mono16k = resampleTo16kHzMono(combined, audioContextRef.current.sampleRate || sampleRate);
          const chunks = createAudioChunks(mono16k, AUDIO_CHUNK_SAMPLES, AUDIO_CHUNK_OVERLAP);
          for (const chunk of chunks) {
            sendChunk(chunk);
          }

          audioBufferRef.current = [];
        }

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      isRecordingRef.current = true;
      setStatus('recording');
      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Unable to start audio stream');
      setError(nextError);
      setStatus('error');
      onError?.(nextError);
      stopMicrophone();
    }
  }, [connectSocket, onError, sampleRate, sendChunk, stopMicrophone]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    status,
    error,
    messages,
    start,
    stop,
    isConnected: status === 'connected' || status === 'recording',
    isRecording: status === 'recording',
  };
}
