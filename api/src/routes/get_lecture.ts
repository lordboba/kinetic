import type { WebsocketHandler } from "@fastify/websocket";
import { lectureDoc } from "../lib/firebase_admin.js";
import type { Lecture } from "schema";

/**
 * WebSocket handler that fetches a complete lecture from Firebase
 * and sends it to the client immediately.
 *
 * The lecture object contains:
 * - version: number
 * - permitted_users: string[]
 * - slides: LectureSlide[] where each slide has:
 *   - transcript: string
 *   - voiceover: string (audio URL)
 *   - title: string
 *   - content?: string (markdown text)
 *   - diagram?: string (mermaid diagram code)
 *   - image?: string (image URL)
 *   - question?: string
 *
 * Query params:
 * - lecture_id: string (required)
 *
 * Response format:
 * { success: true, lecture: Lecture } OR { success: false, error: string }
 */
export const get_lecture_ws: WebsocketHandler = async (ws, req) => {
  const { lecture_id } = req.query as { lecture_id?: string };

  // Validate lecture_id
  if (!lecture_id) {
    ws.send(
      JSON.stringify({
        success: false,
        error: "Missing lecture_id query parameter",
      })
    );
    ws.close();
    return;
  }

  try {
    req.log.info(`Fetching lecture: ${lecture_id}`);

    // Fetch lecture from Firebase
    const lectureRef = lectureDoc(lecture_id);
    const lectureSnapshot = await lectureRef.get();

    if (!lectureSnapshot.exists) {
      req.log.warn(`Lecture not found: ${lecture_id}`);
      ws.send(
        JSON.stringify({
          success: false,
          error: `Lecture with id '${lecture_id}' not found`,
        })
      );
      ws.close();
      return;
    }

    const lecture = lectureSnapshot.data() as Lecture;

    // TODO: Uncomment when auth is fully wired
    // const user = req.user;
    // if (user && !lecture.permitted_users.includes(user.uid)) {
    //   req.log.warn(`User ${user.uid} not permitted to access lecture ${lecture_id}`);
    //   ws.send(JSON.stringify({ success: false, error: "Forbidden: You don't have permission to view this lecture" }));
    //   ws.close();
    //   return;
    // }

    req.log.info(`Successfully fetched lecture: ${lecture_id} with ${lecture.slides?.length || 0} slides`);

    // Send the complete lecture to the client
    // The frontend will use react-markdown to render slide.content as HTML
    // and mermaid to render slide.diagram
    ws.send(
      JSON.stringify({
        success: true,
        lecture,
      })
    );

    // Keep connection open briefly to ensure message is received
    setTimeout(() => {
      ws.close();
    }, 100);
  } catch (error) {
    req.log.error({ error }, "Error fetching lecture");
    ws.send(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch lecture",
      })
    );
    ws.close();
  }
};
