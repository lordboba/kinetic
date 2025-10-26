// backend/middleware/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { getAuth, DecodedIdToken, UserRecord } from "firebase-admin/auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: DecodedIdToken;
  }
}

export async function verify_firebase_token(
  req: FastifyRequest,
  res: FastifyReply
) {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers?.upgrade;
  const isWebSocket =
    typeof upgradeHeader === "string" &&
    upgradeHeader.toLowerCase() === "websocket";

  let idToken: string | undefined;

  // Check Authorization header first (standard for HTTP requests)
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    idToken = authHeader.split(" ")[1];
  }

  // For WebSocket connections, check query parameter as fallback
  // (browsers cannot set custom headers on WebSocket connections)
  if (!idToken && req.query && typeof req.query === "object") {
    const query = req.query as Record<string, unknown>;
    if (typeof query.token === "string") {
      idToken = query.token;
    }
  }

  if (!idToken) {
    // For WebSocket upgrades, we can't send standard HTTP responses
    // The wsHandler will need to handle the rejection
    if (isWebSocket) {
      // Set a flag that the wsHandler can check
      (req as any).authError = "Missing or invalid token";
      return;
    }
    return res
      .status(401)
      .send({ error: "Missing or invalid Authorization header" });
  }

  const auth = getAuth();
  try {
    // Step 1: verify the JWT
    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded; // contains claims, uid, aud, iss, etc.
  } catch (err) {
    // For WebSocket upgrades, we can't send standard HTTP responses
    if (isWebSocket) {
      (req as any).authError = "Invalid or expired Firebase ID token";
      return;
    }
    return res
      .status(401)
      .send({ error: "Invalid or expired Firebase ID token" });
  }
}

// Helper function to verify token from WebSocket query params
export async function verify_websocket_token(
  req: FastifyRequest
): Promise<DecodedIdToken | null> {
  let idToken: string | undefined;

  // Check Authorization header first
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    idToken = authHeader.split(" ")[1];
  }

  // For WebSocket connections, check query parameter
  if (!idToken && req.query && typeof req.query === "object") {
    const query = req.query as Record<string, unknown>;
    if (typeof query.token === "string") {
      idToken = query.token;
    }
  }

  if (!idToken) {
    return null;
  }

  const auth = getAuth();
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    return null;
  }
}
