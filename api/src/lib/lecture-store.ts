import { nanoid } from 'nanoid';
import WebSocket, { type WebSocket as WebSocketClient } from 'ws';

import type { AssetResponse, LectureAsset, LectureJob, ProgressEvent } from '../types.js';

export class LectureStore {
  private readonly lectures = new Map<string, LectureJob>();
  private readonly clients = new Map<string, Set<WebSocketClient>>();

  createLecture(topic: string): LectureJob {
    const id = nanoid();
    const lecture: LectureJob = {
      id,
      topic,
      createdAt: Date.now(),
      assets: {
        transcript: { status: 'pending' },
        slides: { status: 'pending' },
        voiceover: { status: 'pending' },
        diagram: { status: 'pending' },
      },
    };

    this.lectures.set(id, lecture);
    this.clients.set(id, new Set());

    this.enqueueSimulation(lecture).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to simulate lecture generation', error);
    });

    return lecture;
  }

  getLecture(id: string): LectureJob | undefined {
    return this.lectures.get(id);
  }

  attachClient(id: string, socket: WebSocketClient): () => void {
    const sockets = this.clients.get(id);
    if (!sockets) {
      return () => undefined;
    }

    sockets.add(socket);

    return () => {
      sockets.delete(socket);
    };
  }

  broadcastProgress(id: string, payload: ProgressEvent): void {
    const sockets = this.clients.get(id);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const serialized = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  }

  getAsset(id: string, asset: LectureAsset): AssetResponse | undefined {
    const lecture = this.getLecture(id);
    if (!lecture) {
      return undefined;
    }

    const assetState = lecture.assets[asset];
    if (assetState.status !== 'complete' || !assetState.content || !assetState.completedAt) {
      return undefined;
    }

    return {
      id: lecture.id,
      topic: lecture.topic,
      asset,
      content: assetState.content,
      completedAt: assetState.completedAt,
    };
  }

  private async enqueueSimulation(lecture: LectureJob): Promise<void> {
    const order: LectureAsset[] = ['transcript', 'slides', 'diagram', 'voiceover'];
    let delay = 1000;

    for (const asset of order) {
      await this.delay(delay);
      this.completeAsset(lecture.id, asset);
      delay += 500;
    }
  }

  private completeAsset(id: string, asset: LectureAsset): void {
    const lecture = this.lectures.get(id);
    if (!lecture) {
      return;
    }

    const content = this.mockAssetContent(asset, lecture.topic);
    lecture.assets[asset] = {
      status: 'complete',
      content,
      completedAt: Date.now(),
    };

    this.broadcastProgress(id, { type: 'progress', asset, status: 'complete' });
  }

  private mockAssetContent(asset: LectureAsset, topic: string): string {
    switch (asset) {
      case 'transcript':
        return `Lecture transcript for "${topic}" with adaptive explanations and callouts.`;
      case 'slides':
        return `Slide deck outline for "${topic}" highlighting key visuals and summaries.`;
      case 'voiceover':
        return `Voiceover narration script for "${topic}" tailored to paced delivery.`;
      case 'diagram':
        return `Generated diagrams for "${topic}" illustrating core flows and relationships.`;
      default: {
        const _never: never = asset;
        return _never;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
