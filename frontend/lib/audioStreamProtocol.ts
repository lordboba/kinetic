const CHUNK_MAGIC = 'LGAC';
const HEADER_SIZE = 28;
const UTF8_DECODER = new TextDecoder();
const ASCII_DECODER = new TextDecoder('ascii');

export type BinarySlideAudioChunk = {
  slideIndex: number;
  chunkIndex: number;
  sampleRate: number;
  channels: number;
  samplesPerChannel: number;
  transcriptDelta?: string;
  pcm16: Int16Array;
};

export function parseBinaryAudioChunk(buffer: ArrayBuffer): BinarySlideAudioChunk | null {
  if (buffer.byteLength < HEADER_SIZE) {
    console.warn('[audioStreamProtocol] Chunk too small:', buffer.byteLength);
    return null;
  }

  const headerView = new DataView(buffer, 0, HEADER_SIZE);
  const magic = ASCII_DECODER.decode(buffer.slice(0, 4));
  if (magic !== CHUNK_MAGIC) {
    console.warn('[audioStreamProtocol] Invalid magic prefix:', magic);
    return null;
  }

  const version = headerView.getUint8(4);
  if (version !== 1) {
    console.warn('[audioStreamProtocol] Unsupported chunk version:', version);
    return null;
  }

  const transcriptLength = headerView.getUint16(26, true);
  const slideIndex = headerView.getUint32(8, true);
  const chunkIndex = headerView.getUint32(12, true);
  const sampleRate = headerView.getUint32(16, true);
  const channels = headerView.getUint16(20, true);
  const samplesPerChannel = headerView.getUint32(22, true);

  const transcriptStart = HEADER_SIZE;
  const transcriptEnd = transcriptStart + transcriptLength;

  if (transcriptEnd > buffer.byteLength) {
    console.warn('[audioStreamProtocol] Transcript length exceeds chunk size');
    return null;
  }

  const pcmStart = transcriptEnd;
  const expectedBytes = samplesPerChannel * channels * 2;
  const pcmBytes = buffer.byteLength - pcmStart;

  if (pcmBytes !== expectedBytes) {
    console.warn('[audioStreamProtocol] Unexpected PCM payload length', {
      expectedBytes,
      pcmBytes,
    });
    return null;
  }

  const transcriptDelta =
    transcriptLength > 0
      ? UTF8_DECODER.decode(buffer.slice(transcriptStart, transcriptEnd))
      : undefined;

  const pcm16 = new Int16Array(buffer.slice(pcmStart));

  return {
    slideIndex,
    chunkIndex,
    sampleRate,
    channels,
    samplesPerChannel,
    transcriptDelta,
    pcm16,
  };
}
