import type { FastifyInstance } from 'fastify';

import { createLectureAssetHandler } from './lecture-asset.js';
import { createLectureStreamHandler } from './lecture-stream.js';
import { registerNewLectureRoute } from './new-lecture.js';
import { createTtsHttpHandler, createTtsWebsocketHandler } from './tts-websocket.js';
import { LectureStore } from '../lib/lecture-store.js';

export function registerRoutes(app: FastifyInstance, lectureStore: LectureStore): void {
  registerNewLectureRoute(app, lectureStore);

  app.route({
    method: 'GET',
    url: '/api/lecture',
    websocket: true,
    handler: createLectureAssetHandler(lectureStore),
    wsHandler: createLectureStreamHandler(lectureStore),
  });

  app.route({
    method: 'GET',
    url: '/api/tts',
    websocket: true,
    handler: createTtsHttpHandler(),
    wsHandler: createTtsWebsocketHandler(),
  });
}
