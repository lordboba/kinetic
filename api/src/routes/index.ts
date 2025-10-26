import type { FastifyInstance, RouteHandler } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  createTtsHttpHandler,
  createTtsWebsocketHandler,
} from "./tts-websocket.js";
import { LectureStore } from "../lib/lecture-store.js";
import type { WebsocketHandler } from "@fastify/websocket";
import { create_lecture_initial } from "./create_lecture.js";
import { verify_firebase_token } from "../middleware/firebase.js";
import {
  get_profile_handler,
  update_preferences_handler,
  create_profile_handler,
} from "./user_profile.js";

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
  const MAX_RESPONSE_LOG_BYTES = 1024 * 16;

  app.addHook("onSend", async (request, reply, payload) => {
    // Skip logging for websocket upgrade routes.
    if (reply.raw.statusCode === 101) {
      return payload;
    }

    let responsePreview = "<empty>";

    if (payload !== undefined && payload !== null) {
      try {
        if (Buffer.isBuffer(payload)) {
          responsePreview = payload.toString("utf8");
        } else if (typeof payload === "string") {
          responsePreview = payload;
        } else {
          responsePreview = JSON.stringify(payload);
        }
      } catch (error) {
        responsePreview = `[unserializable payload: ${(error as Error).message}]`;
      }
    }

    if (responsePreview.length > MAX_RESPONSE_LOG_BYTES) {
      responsePreview =
        responsePreview.slice(0, MAX_RESPONSE_LOG_BYTES) + "...(truncated)";
    }

    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        response: responsePreview,
      },
      "response sent"
    );

    return payload;
  });

  app.register(fastifyMultipart);
  // registerNewLectureRoute(app, lectureStore);

  app.post("/api/create-lecture-initial", {
    preHandler: verify_firebase_token,
    handler: create_lecture_initial,
  });

  // User profile routes
  app.get("/api/users/profile", {
    preHandler: verify_firebase_token,
    handler: get_profile_handler,
  });

  app.put("/api/users/profile/preferences", {
    preHandler: verify_firebase_token,
    handler: update_preferences_handler,
  });

  app.post("/api/users/profile", {
    preHandler: verify_firebase_token,
    handler: create_profile_handler,
  });

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
