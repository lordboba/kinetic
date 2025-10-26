import type { FastifyInstance, RouteHandler } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  createTtsHttpHandler,
  createTtsWebsocketHandler,
} from "./tts-websocket.js";
import { LectureStore } from "../lib/lecture-store.js";
import type { WebsocketHandler } from "@fastify/websocket";

const createLectureAssetHandler = (
  _lectureStore: LectureStore,
): RouteHandler => {
  return async (_request, reply) => {
    reply.code(501).send({
      error: "not_implemented",
      message:
        "Lecture asset retrieval is not yet implemented. TODO: wire up createLectureAssetHandler.",
    });
  };
};

const createLectureStreamHandler = (
  _lectureStore: LectureStore,
): WebsocketHandler => {
  return (socket) => {
    socket.close(1011, "Lecture stream handler not yet connected.");
  };
};

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
