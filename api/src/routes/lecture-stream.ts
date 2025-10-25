import type { WebsocketHandler } from '@fastify/websocket';
import type { RawData } from 'ws';

import { LectureStore } from '../lib/lecture-store.js';
import type { LectureAsset, LectureAssetState, ProgressEvent } from '../types.js';

export function createLectureStreamHandler(lectureStore: LectureStore): WebsocketHandler {
  return (socket, request) => {
    const queryId = (request.query as { id?: unknown } | undefined)?.id;
    if (typeof queryId !== 'string' || queryId.length === 0) {
      socket.close(1008, 'Lecture id is required');
      return;
    }

    const lecture = lectureStore.getLecture(queryId);
    if (!lecture) {
      socket.close(1008, 'Lecture not found');
      return;
    }

    const detach = lectureStore.attachClient(queryId, socket);

    for (const [asset, state] of Object.entries(lecture.assets) as [LectureAsset, LectureAssetState][]) {
      socket.send(JSON.stringify({ type: 'progress', asset, status: state.status } satisfies ProgressEvent));
    }

    socket.on('message', (message: RawData) => {
      const preview = serializeMessage(message);
      // eslint-disable-next-line no-console
      console.log('Received message for lecture %s: %s', queryId, preview);
    });

    socket.on('close', detach);
    socket.on('error', detach);
  };
}

function serializeMessage(message: RawData): string {
  if (Buffer.isBuffer(message)) {
    return message.toString('utf8');
  }

  if (typeof message === 'string') {
    return message;
  }

  return '[unsupported message payload]';
}
