import WebSocket from 'ws';

export type SlideAudioChunkMessage = {
  type: 'slide_audio_chunk';
  lecture_id: string;
  slide_index: number;
  chunk_index: number;
  sample_rate: number;
  channels: number;
  samples_per_channel: number;
  pcm16: Buffer;
  transcript_delta?: string;
  is_final?: boolean;
};

export type SlideAudioStatusMessage = {
  type: 'slide_audio_status';
  lecture_id: string;
  slide_index: number;
  status: 'started' | 'completed' | 'error';
  audio_url?: string;
  error?: string;
};

export type SlideAudioBufferMessage = {
  type: 'slide_audio_buffer';
  lecture_id: string;
  slide_index: number;
  chunk_index: number;
  buffered_ms: number;
  ready_to_advance?: boolean;
  is_complete?: boolean;
};

type SubscriberOptions = {
  acceptsChunks: boolean;
};

type LectureStreamSession = {
  lectureId: string;
  subscribers: Map<WebSocket, SubscriberOptions>;
};

class LectureAudioStreamBroker {
  #sessions = new Map<string, LectureStreamSession>();

  addSubscriber(lectureId: string, socket: WebSocket, options?: Partial<SubscriberOptions>): void {
    const session = this.#ensureSession(lectureId);
    session.subscribers.set(socket, {
      acceptsChunks: options?.acceptsChunks ?? true,
    });

    const cleanup = () => {
      this.removeSubscriber(lectureId, socket);
    };

    socket.once('close', cleanup);
    socket.once('error', cleanup);
  }

  removeSubscriber(lectureId: string, socket: WebSocket): void {
    const session = this.#sessions.get(lectureId);
    if (!session) {
      return;
    }

    session.subscribers.delete(socket);
    if (session.subscribers.size === 0) {
      this.#sessions.delete(lectureId);
    }
  }

  publishChunk(message: SlideAudioChunkMessage): void {
    this.#broadcast(message.lecture_id, message);
  }

  publishStatus(message: SlideAudioStatusMessage): void {
    this.#broadcast(message.lecture_id, message);
  }

  publishBuffer(message: SlideAudioBufferMessage): void {
    this.#broadcast(message.lecture_id, message);
  }

  #ensureSession(lectureId: string): LectureStreamSession {
    if (!this.#sessions.has(lectureId)) {
      this.#sessions.set(lectureId, {
        lectureId,
        subscribers: new Map<WebSocket, SubscriberOptions>(),
      });
    }
    return this.#sessions.get(lectureId)!;
  }

  #broadcast(
    lectureId: string,
    payload: SlideAudioChunkMessage | SlideAudioStatusMessage | SlideAudioBufferMessage,
  ): void {
    const session = this.#sessions.get(lectureId);
    if (!session || session.subscribers.size === 0) {
      return;
    }

    if (payload.type === 'slide_audio_chunk') {
      const encodedChunk = encodeBinaryChunk(payload);
      for (const [socket, subscriberOptions] of session.subscribers.entries()) {
        if (!subscriberOptions.acceptsChunks) {
          continue;
        }
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(encodedChunk, { binary: true });
        }
      }
      return;
    }

    const encoded = JSON.stringify(payload);
    for (const socket of session.subscribers.keys()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }
}

export const lectureAudioStreamBroker = new LectureAudioStreamBroker();

const CHUNK_MAGIC = Buffer.from('LGAC', 'ascii');
const CHUNK_VERSION = 1;
const CHUNK_HEADER_SIZE = 28;

function encodeBinaryChunk(message: SlideAudioChunkMessage): Buffer {
  const transcript = message.transcript_delta ?? '';
  const transcriptBuffer = Buffer.from(transcript, 'utf8');
  if (transcriptBuffer.length > 0xffff) {
    throw new Error('Transcript delta exceeds 64KB limit for streaming chunk metadata');
  }

  const expectedPcmBytes = message.samples_per_channel * message.channels * 2;
  if (message.pcm16.length !== expectedPcmBytes) {
    throw new Error(
      `PCM payload size mismatch: expected ${expectedPcmBytes} bytes, received ${message.pcm16.length}`,
    );
  }

  const header = Buffer.allocUnsafe(CHUNK_HEADER_SIZE);
  let offset = 0;

  CHUNK_MAGIC.copy(header, offset);
  offset += 4;

  header.writeUInt8(CHUNK_VERSION, offset);
  offset += 1;

  const flags = transcriptBuffer.length > 0 ? 1 : 0;
  header.writeUInt8(flags, offset);
  offset += 1;

  header.writeUInt16LE(0, offset); // reserved
  offset += 2;

  header.writeUInt32LE(message.slide_index, offset);
  offset += 4;

  header.writeUInt32LE(message.chunk_index, offset);
  offset += 4;

  header.writeUInt32LE(message.sample_rate, offset);
  offset += 4;

  header.writeUInt16LE(message.channels, offset);
  offset += 2;

  header.writeUInt32LE(message.samples_per_channel, offset);
  offset += 4;

  header.writeUInt16LE(transcriptBuffer.length, offset);
  offset += 2;

  return Buffer.concat([header, transcriptBuffer, message.pcm16]);
}
