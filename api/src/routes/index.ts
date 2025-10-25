import type { FastifyInstance } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  createTtsHttpHandler,
  createTtsWebsocketHandler,
} from "./tts-websocket.js";
import { LectureStore } from "../lib/lecture-store.js";

export function registerRoutes(
  app: FastifyInstance,
  lectureStore: LectureStore
): void {
  app.register(fastifyMultipart);
  // registerNewLectureRoute(app, lectureStore);

  app.route({
    method: "GET",
    url: "/api/lecture",
    websocket: true,
    handler: createLectureAssetHandler(lectureStore),
    wsHandler: createLectureStreamHandler(lectureStore),
  });

  app.route({
    method: "GET",
    url: "/api/tts",
    websocket: true,
    handler: createTtsHttpHandler(),
    wsHandler: createTtsWebsocketHandler(),
  });
}
