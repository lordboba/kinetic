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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .send({ error: "Missing or invalid Authorization header" });
  }

  const idToken = authHeader.split(" ")[1];
  const auth = getAuth();
  try {
    // Step 1: verify the JWT
    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded; // contains claims, uid, aud, iss, etc.
  } catch (err) {
    return res
      .status(401)
      .send({ error: "Invalid or expired Firebase ID token" });
  }
}
