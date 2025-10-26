import { RouteHandler } from "fastify";
import { DecodedIdToken } from "firebase-admin/auth";
import { get_user_profile, lectureDoc } from "../lib/firebase_admin.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: DecodedIdToken;
  }
}

export const get_lectures: RouteHandler = async (req, res) => {
  if (!req.user?.uid) {
    req.log.warn("[get_lectures] Unauthorized request - no user");
    return res.code(401).send({
      success: false,
      error: "Unauthorized",
    });
  }

  const { uid } = req.user;

  try {
    req.log.info(
      {
        user_id: uid,
        timestamp: new Date().toISOString(),
      },
      "[get_lectures] Fetching lectures for user"
    );

    // Get user profile with lecture IDs
    const userProfile = await get_user_profile(uid);

    if (!userProfile) {
      req.log.warn(
        {
          user_id: uid,
        },
        "[get_lectures] User profile not found"
      );
      return res.code(404).send({
        success: false,
        error: "User profile not found",
      });
    }

    const lecture_ids = userProfile.lectures ?? [];

    if (lecture_ids.length === 0) {
      req.log.info(
        {
          user_id: uid,
        },
        "[get_lectures] User has no lectures"
      );
      return res.code(200).send({
        success: true,
        lectures: [],
      });
    }

    req.log.info(
      {
        user_id: uid,
        lecture_count: lecture_ids.length,
      },
      "[get_lectures] Fetching lecture documents"
    );

    // Fetch all lecture documents in parallel
    const lectureResults = await Promise.allSettled(
      lecture_ids.map(async (id) => {
        const docSnapshot = await lectureDoc(id).get();
        return { id, snapshot: docSnapshot };
      })
    );

    // Process results and filter out invalid lectures
    const lectures = lectureResults
      .map((result, index) => {
        const lectureId = lecture_ids[index];

        if (result.status === "rejected") {
          req.log.error(
            {
              user_id: uid,
              lecture_id: lectureId,
              error: result.reason,
            },
            "[get_lectures] Failed to fetch lecture document"
          );
          return null;
        }

        const { snapshot } = result.value;

        if (!snapshot.exists) {
          req.log.warn(
            {
              user_id: uid,
              lecture_id: lectureId,
            },
            "[get_lectures] Lecture document does not exist"
          );
          return null;
        }

        const data = snapshot.data();

        if (!data) {
          req.log.warn(
            {
              user_id: uid,
              lecture_id: lectureId,
            },
            "[get_lectures] Lecture document has no data"
          );
          return null;
        }

        // Check if lecture is still pending (stub only) - ignore these
        if (!data.topic || !data.slides) {
          req.log.info(
            {
              user_id: uid,
              lecture_id: lectureId,
              has_topic: !!data.topic,
              has_slides: !!data.slides,
            },
            "[get_lectures] Lecture is incomplete (pending generation) - ignoring"
          );
          return null;
        }

        // Return complete lecture info
        return {
          lecture_id: lectureId,
          lecture_topic: data.topic,
          status: "complete",
          slide_count: data.slides?.length ?? 0,
          created_at: data.createdAt ?? null,
        };
      })
      .filter((lecture) => lecture !== null);

    req.log.info(
      {
        user_id: uid,
        total_lecture_ids: lecture_ids.length,
        valid_lectures: lectures.length,
        filtered_out: lecture_ids.length - lectures.length,
      },
      "[get_lectures] Successfully fetched lectures"
    );

    return res.code(200).send({
      success: true,
      lectures,
    });
  } catch (error) {
    req.log.error(
      {
        user_id: uid,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[get_lectures] Unexpected error while fetching lectures"
    );

    return res.code(500).send({
      success: false,
      error: "Failed to fetch lectures",
    });
  }
};
