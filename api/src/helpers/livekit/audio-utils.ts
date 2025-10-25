import { AudioFrame, combineAudioFrames } from '@livekit/rtc-node';

export type DecodedAudio = {
  sampleRate: number;
  channels: number;
  samples: Int16Array;
};

const WAV_HEADER_SIZE = 44;

export function isWav(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
}

export function decodeWav(buffer: Buffer): DecodedAudio {
  if (!isWav(buffer)) {
    throw new Error('Unsupported audio format: expected a WAV/RIFF container');
  }

  let offset = 12; // skip RIFF header
  let formatChunkFound = false;
  let dataChunkFound = false;

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataView: Buffer | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > buffer.length) {
      throw new Error('Malformed WAV file: chunk exceeds buffer length');
    }

    if (chunkId === 'fmt ') {
      formatChunkFound = true;
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      dataChunkFound = true;
      dataView = buffer.subarray(chunkStart, chunkEnd);
    }

    // Chunks are word aligned; skip padding byte if present
    offset = chunkEnd + (chunkSize % 2 === 1 ? 1 : 0);

    if (formatChunkFound && dataChunkFound) {
      break;
    }
  }

  if (!formatChunkFound || !dataChunkFound || dataView === null) {
    throw new Error('Malformed WAV file: missing fmt or data chunk');
  }

  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV audio format ${audioFormat}; only PCM (1) is supported`);
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth ${bitsPerSample}; only 16-bit PCM is supported`);
  }

  if (channels <= 0) {
    throw new Error('Invalid WAV channel count');
  }

  if (sampleRate <= 0) {
    throw new Error('Invalid WAV sample rate');
  }

  return {
    sampleRate,
    channels,
    samples: new Int16Array(dataView.buffer, dataView.byteOffset, dataView.byteLength / 2),
  };
}

export function pcmToAudioFrames(
  samples: Int16Array,
  sampleRate: number,
  channels: number,
  targetSamplesPerFrame = Math.floor(sampleRate / 10),
): AudioFrame[] {
  if (samples.length === 0) {
    return [];
  }

  if (channels <= 0) {
    throw new Error('Channel count must be a positive integer');
  }

  const frames: AudioFrame[] = [];
  const frameStride = targetSamplesPerFrame * channels;

  for (let offset = 0; offset < samples.length; offset += frameStride) {
    const remaining = samples.length - offset;
    const currentStride = Math.min(frameStride, remaining);
    const currentSamplesPerChannel = currentStride / channels;

    if (!Number.isInteger(currentSamplesPerChannel)) {
      throw new Error('PCM buffer length is not evenly divisible by the channel count');
    }

    const frameData = samples.slice(offset, offset + currentStride);
    frames.push(new AudioFrame(frameData, sampleRate, channels, currentSamplesPerChannel));
  }

  return frames;
}

export function audioFramesToWav(frames: AudioFrame[]): Buffer {
  if (frames.length === 0) {
    throw new Error('Cannot encode WAV from an empty frame list');
  }

  const combined = combineAudioFrames(frames);
  const { sampleRate, channels, samplesPerChannel, data } = combined;

  const bytesPerSample = 2; // Int16
  const dataByteLength = data.length * bytesPerSample;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;

  const buffer = Buffer.allocUnsafe(WAV_HEADER_SIZE + dataByteLength);
  let offset = 0;

  buffer.write('RIFF', offset);
  offset += 4;
  buffer.writeUInt32LE(WAV_HEADER_SIZE - 8 + dataByteLength, offset);
  offset += 4;
  buffer.write('WAVE', offset);
  offset += 4;

  buffer.write('fmt ', offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset); // PCM chunk size
  offset += 4;
  buffer.writeUInt16LE(1, offset); // PCM format
  offset += 2;
  buffer.writeUInt16LE(channels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(16, offset); // bits per sample
  offset += 2;

  buffer.write('data', offset);
  offset += 4;
  buffer.writeUInt32LE(dataByteLength, offset);
  offset += 4;

  const pcmBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  pcmBuffer.copy(buffer, offset);

  return buffer;
}
