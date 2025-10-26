import { RouteHandler } from "fastify";
import {
  CreateLectureUploadSchema,
  LecturePreferencesSchema,
} from "../schemas/create-lecture.js";
import { buildFileUploadsForLLM } from "../helpers/file";
import { ASSET_CACHE } from "../lib/file_cache";
import * as z from "zod";
import { create_lecture_stub, get_user_profile } from "../lib/firebase_admin";
import { CreateLectureInitialResponse, LecturePreferences } from "schema";
import {
  ZGenerateClarifyingQuestionsRequest,
  generate_clarifying_questions,
} from "../helpers/claude/clarifying_questions";
import { llm } from "../lib/mouse";
import { WebsocketHandler } from "@fastify/websocket";
import { generate_transcript } from "../helpers/claude/transcript";

const DEFAULT_LECTURE_PREFERENCES: LecturePreferences =
  LecturePreferencesSchema.parse({
    lecture_length: "medium",
    tone: "warm",
    enable_questions: true,
  });

export const create_lecture_initial: RouteHandler = async (req, res) => {
  const isMultipart =
    typeof req.isMultipart === "function" && req.isMultipart();

  let data: z.infer<typeof CreateLectureUploadSchema>;

  if (isMultipart) {
    let lectureConfigRaw: unknown = undefined;
    let lecturePrefsRaw: unknown = undefined;

    const fileParts: Array<{
      filename: string;
      mimetype: string;
      file: NodeJS.ReadableStream;
    }> = [];

    // req.parts() is AsyncIterable<Multipart | MultipartFile>, where
    // - MultipartFile has: file, filename, mimetype, fieldname, etc.
    // - MultipartValue<T> has: value, fieldname, etc.
    // We have to narrow manually.

    for await (const part of req.parts()) {
      // FILE BRANCH
      if ("file" in part && typeof part.file !== "undefined") {
        if (part.fieldname === "files") {
          fileParts.push({
            filename: part.filename,
            mimetype: part.mimetype,
            file: part.file,
          });
        } else {
          return res.code(400).send({
            success: false,
            error: `Unexpected file field '${part.fieldname}'`,
          });
        }

        continue;
      }

      // TEXT BRANCH
      if ("value" in part) {
        if (part.fieldname === "lecture_config") {
          try {
            lectureConfigRaw = JSON.parse(part.value as string);
          } catch {
            return res
              .code(400)
              .send({ error: "lecture_config is not valid JSON" });
          }
        } else if (part.fieldname === "lecture_preferences") {
          try {
            lecturePrefsRaw = JSON.parse(part.value as string);
          } catch {
            return res
              .code(400)
              .send({ error: "lecture_preferences is not valid JSON" });
          }
        } else if (part.fieldname === "files") {
          return res.code(400).send({
            success: false,
            error:
              "Expected 'files' to be file upload(s), not text. Got text field.",
          });
        } else {
          return res.code(400).send({
            success: false,
            error: `Unexpected field '${part.fieldname}'`,
          });
        }

        continue;
      }

      return res.code(400).send({
        success: false,
        error: "Received multipart part of unknown type",
      });
    }

    const candidate = {
      lecture_config: lectureConfigRaw,
      lecture_preferences: lecturePrefsRaw,
      files: fileParts.length > 0 ? fileParts : undefined,
    };

    const parsed = CreateLectureUploadSchema.safeParse(candidate);

    if (!parsed.success) {
      return res.code(400).send({
        error: "Validation failed",
        details: z.treeifyError(parsed.error),
      });
    }

    data = parsed.data;
  } else {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.code(400).send({
        error: "Expected JSON object body",
      });
    }

    const bodyRecord = body as Record<string, unknown>;
    const candidate = {
      lecture_config: bodyRecord.lecture_config,
      lecture_preferences: bodyRecord.lecture_preferences,
      files: undefined,
    };

    const parsed = CreateLectureUploadSchema.safeParse(candidate);

    if (!parsed.success) {
      return res.code(400).send({
        error: "Validation failed",
        details: z.treeifyError(parsed.error),
      });
    }

    data = parsed.data;
  }

  const user = req.user;

  if (!user?.uid) {
    req.log.warn({ hasUser: Boolean(user) }, "Unauthorized create lecture attempt");
    return res.code(401).send({
      success: false,
      error: "Unauthorized",
    });
  }

  const { uid } = user;
  const llmFiles = await buildFileUploadsForLLM(data.files);

  // Fetch user profile to get saved preferences
  const userProfile = await get_user_profile(uid);
  const savedPreferences = userProfile?.preferences ?? DEFAULT_LECTURE_PREFERENCES;

  // Use lecture-specific preferences if provided, otherwise use saved/default preferences
  const userPreferences = data.lecture_preferences ?? savedPreferences;

  const clarifyingRequest = ZGenerateClarifyingQuestionsRequest.parse({
    topic: data.lecture_config.lecture_topic,
    user_preferences: userPreferences,
    custom_preferences: data.lecture_preferences,
  });

  const stub = await create_lecture_stub(uid, userPreferences);
  ASSET_CACHE.set(stub, { uid, files: llmFiles });
  const questions = await generate_clarifying_questions(llm, clarifyingRequest);

  return res.code(200).send({
    lecture_id: stub,
    questions,
    success: true,
  } satisfies CreateLectureInitialResponse);
};

// export const create_lecture_main: WebsocketHandler = async (ws, req) => {
//   const { lecture_id } = req.query as { lecture_id: string };
//   const user = req.user!;

//   const cachedFiles = ASSET_CACHE.get(lecture_id);
//   if (!cachedFiles || cachedFiles.uid !== user.uid) {
//     ws.send(
//       JSON.stringify({
//         success: false,
//         error: "Lecture not found or forbidden",
//       })
//     );
//     ws.close();
//     return;
//   }

//   const

//   const transcript = generate_transcript(llm, {
//     questions:
//   });
// };
