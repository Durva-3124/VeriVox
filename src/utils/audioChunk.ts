export const AUDIO_CHUNK_SAMPLES = 3200;
export const AUDIO_CHUNK_OVERLAP = 1600;
export const DEFAULT_STREAM_WS_URL = 'ws://localhost:8000/stream';

export interface AudioChunkPayload {
  sessionId: string;
  claimedVoiceprintId?: string;
  carrierOrigin?: string;
  sampleRate: number;
  audioChunkB64: string;
}

export function resampleTo16kHzMono(samples: Float32Array, sourceSampleRate = 48000): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0);
  }

  if (sourceSampleRate === 16000) {
    return samples.slice();
  }

  const outputLength = Math.max(1, Math.ceil(samples.length * (16000 / sourceSampleRate)));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const position = (i / Math.max(1, outputLength - 1)) * (samples.length - 1);
    const index = Math.floor(position);
    const fraction = position - index;
    const left = samples[index] ?? 0;
    const right = samples[Math.min(index + 1, samples.length - 1)] ?? left;
    output[i] = left + (right - left) * fraction;
  }

  return output;
}

export function createAudioChunks(samples: Float32Array, chunkSize = AUDIO_CHUNK_SAMPLES, hopSize = AUDIO_CHUNK_OVERLAP): Float32Array[] {
  if (samples.length === 0) {
    return [];
  }

  const chunks: Float32Array[] = [];
  let start = 0;

  while (start + chunkSize <= samples.length) {
    const chunk = samples.slice(start, start + chunkSize);
    chunks.push(chunk);
    start += hopSize;
  }

  const remainder = samples.length - start;
  if (remainder > 0) {
    const padded = new Float32Array(chunkSize);
    padded.set(samples.slice(start), 0);
    chunks.push(padded);
  }

  return chunks;
}

export function float32ToBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export function createAudioChunkMessage({
  sessionId,
  claimedVoiceprintId,
  carrierOrigin,
  sampleRate,
  chunk,
}: {
  sessionId: string;
  claimedVoiceprintId?: string;
  carrierOrigin?: string;
  sampleRate: number;
  chunk: Float32Array;
}): AudioChunkPayload {
  return {
    sessionId,
    claimedVoiceprintId,
    carrierOrigin,
    sampleRate,
    audioChunkB64: float32ToBase64(chunk),
  };
}
