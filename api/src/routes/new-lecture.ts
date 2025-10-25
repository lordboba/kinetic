import type { FastifyInstance } from 'fastify';

import { LectureStore } from '../lib/lecture-store.js';

export function registerNewLectureRoute(app: FastifyInstance, lectureStore: LectureStore): void {
  app.post<{ Body: { topic?: string } }>('/api/newLecture', async (request, reply) => {
    const { topic } = request.body ?? {};
    if (!topic || typeof topic !== 'string') {
      return reply.status(400).send({ error: 'Missing required "topic" field' });
    }

    const lecture = lectureStore.createLecture(topic);
    return reply.status(201).send({ id: lecture.id });
  });
}
