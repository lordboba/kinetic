import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import Fastify from "fastify";

import { LectureStore } from "./lib/lecture-store.js";
import { registerRoutes } from "./routes/index.js";

const lectureStore = new LectureStore();

async function main(): Promise<void> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "production",
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(websocketPlugin);
  registerRoutes(app, lectureStore);

  const port = Number.parseInt(process.env.PORT ?? "4000", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(`🚀 LectureGen API running at http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
