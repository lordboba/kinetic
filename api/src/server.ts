import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env file (two levels up from dist/server.js)
const envPath = resolve(__dirname, "../../.env");
console.log(`[server] Loading .env from: ${envPath}`);
const result = config({ path: envPath });
if (result.error) {
  console.error(`[server] Error loading .env:`, result.error);
} else {
  console.log(`[server] .env loaded successfully`);
}

// Use dynamic imports to ensure environment variables are loaded first
import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import Fastify from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    llm: any;
  }
}

async function main(): Promise<void> {
  // Dynamic imports after dotenv loads
  const { registerRoutes } = await import("./routes/index.js");

  const app = Fastify({
    logger: process.env.NODE_ENV !== "production",
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(websocketPlugin);
  registerRoutes(app);

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
