import WebSocket from 'ws';

export type SlideAudioChunkMessage = {
  type: 'slide_audio_chunk';
  lecture_id: string;
  slide_index: number;
  chunk_index: number;
  sample_rate: number;
  channels: number;
  samples_per_channel: number;
  pcm16_base64: string;
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

type LectureStreamSession = {
  lectureId: string;
  subscribers: Set<WebSocket>;
};

class LectureAudioStreamBroker {
  #sessions = new Map<string, LectureStreamSession>();

  addSubscriber(lectureId: string, socket: WebSocket): void {
    const session = this.#ensureSession(lectureId);
    session.subscribers.add(socket);

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
        subscribers: new Set<WebSocket>(),
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

    const encoded = JSON.stringify(payload);
    for (const socket of session.subscribers) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }
}

export const lectureAudioStreamBroker = new LectureAudioStreamBroker();
