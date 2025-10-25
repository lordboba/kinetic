import type { FastifyReply, FastifyRequest } from 'fastify';

import { LectureStore } from '../lib/lecture-store.js';
import type { LectureAsset } from '../types.js';

type LectureAssetQuery = {
  id?: string;
  asset?: string;
};

export function createLectureAssetHandler(lectureStore: LectureStore) {
  return async function lectureAssetHandler(
    request: FastifyRequest<{ Querystring: LectureAssetQuery }>,
    reply: FastifyReply,
  ) {
    const { id, asset: assetParam } = request.query;
    if (!id || !assetParam) {
      return reply.status(400).send({ error: 'Both "id" and "asset" query parameters are required' });
    }

    const asset = normalizeAsset(assetParam);
    if (!asset) {
      return reply.status(400).send({ error: `Unknown asset "${assetParam}"` });
    }

    const response = lectureStore.getAsset(id, asset);
    if (!response) {
      return reply.status(404).send({ error: 'Asset not available yet' });
    }

    await reply.send(response);
  };
}

function normalizeAsset(value: string): LectureAsset | undefined {
  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'transcript':
      return 'transcript';
    case 'slide':
    case 'slides':
      return 'slides';
    case 'voiceover':
      return 'voiceover';
    case 'diagram':
    case 'diagrams':
      return 'diagram';
    default:
      return undefined;
  }
}
