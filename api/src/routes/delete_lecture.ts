import { RouteHandler } from "fastify";
import {
  admin,
  lectureDoc,
  userProfileDoc,
} from "../lib/firebase_admin.js";

interface DeleteLectureParams {
  lecture_id?: string;
}

export const delete_lecture: RouteHandler<{
  Params: DeleteLectureParams;
}> = async (req, res) => {
  if (!req.user?.uid) {
    req.log.warn("[delete_lecture] Unauthorized request - no user");
    return res.code(401).send({
      success: false,
      error: "Unauthorized",
    });
  }

  const lectureId = req.params?.lecture_id;

  if (!lectureId) {
    req.log.warn("[delete_lecture] Missing lecture_id parameter");
    return res.code(400).send({
      success: false,
      error: "lecture_id is required",
    });
  }

  const { uid } = req.user;

  try {
    req.log.info(
      {
        lecture_id: lectureId,
        user_id: uid,
      },
      "[delete_lecture] Received delete lecture request"
    );

    const docRef = lectureDoc(lectureId);
    const lectureSnapshot = await docRef.get();

    if (!lectureSnapshot.exists) {
      req.log.warn(
        {
          lecture_id: lectureId,
          user_id: uid,
        },
        "[delete_lecture] Lecture not found"
      );
      return res.code(404).send({
        success: false,
        error: "Lecture not found",
      });
    }

    const lectureData = lectureSnapshot.data();
    const permittedUsers: string[] = Array.isArray(
      lectureData?.permitted_users
    )
      ? (lectureData?.permitted_users as string[])
      : [];

    if (!permittedUsers.includes(uid)) {
      req.log.warn(
        {
          lecture_id: lectureId,
          user_id: uid,
        },
        "[delete_lecture] User is not permitted to delete lecture"
      );
      return res.code(403).send({
        success: false,
        error: "You do not have permission to delete this lecture",
      });
    }

    await docRef.delete();

    req.log.info(
      {
        lecture_id: lectureId,
        user_id: uid,
      },
      "[delete_lecture] Lecture document deleted"
    );

    const removalResults = await Promise.allSettled(
      permittedUsers.map(async (permittedUid) => {
        await userProfileDoc(permittedUid).update({
          lectures: admin.firestore.FieldValue.arrayRemove(lectureId),
          updatedAt: Date.now(),
        });
        return permittedUid;
      })
    );

    for (const [index, result] of removalResults.entries()) {
      if (result.status === "rejected") {
        req.log.error(
          {
            lecture_id: lectureId,
            user_id: permittedUsers[index],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          },
          "[delete_lecture] Failed to remove lecture from user profile"
        );
      }
    }

    const failedRemovals = removalResults.filter(
      (result) => result.status === "rejected"
    ).length;

    req.log.info(
      {
        lecture_id: lectureId,
        user_id: uid,
        permitted_users: permittedUsers.length,
        failed_profile_updates: failedRemovals,
      },
      "[delete_lecture] Lecture deletion completed"
    );

    return res.code(200).send({
      success: true,
      lecture_id: lectureId,
      removed_from_profiles: permittedUsers.length - failedRemovals,
    });
  } catch (error) {
    req.log.error(
      {
        lecture_id: lectureId,
        user_id: uid,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[delete_lecture] Unexpected error while deleting lecture"
    );

    return res.code(500).send({
      success: false,
      error: "Failed to delete lecture",
    });
  }
};
