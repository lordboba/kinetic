import { RouteHandler } from "fastify";
import {
  CreateLectureUploadSchema,
  LecturePreferencesSchema,
} from "../schemas/create-lecture.js";
import { buildFileUploadsForLLM } from "../helpers/file";
import { ASSET_CACHE } from "../lib/file_cache";
import * as z from "zod";
import {
  get_user_profile,
  create_lecture_stub,
  userProfileDoc,
  lectureDoc,
  admin,
} from "../lib/firebase_admin";
import {
  LecturePreferences,
  CreateLectureInitialResponse,
  CreateLectureMainRequest,
  CreateLectureStatusUpdate,
  Lecture,
  LectureSlide,
} from "schema";
import {
  ZGenerateClarifyingQuestionsRequest,
  generate_clarifying_questions,
} from "../helpers/claude/clarifying_questions";
import { llm, haikuLlm } from "../lib/mouse";
import { WebsocketHandler } from "@fastify/websocket";
import { generate_transcript } from "../helpers/claude/transcript";
import { generateMermaidDiagrams } from "../helpers/claude/mermaid";
import { getImageForKeyword } from "../helpers/image";
import { generateAvatarSpeech } from "../helpers/livekit/tts";
import { stripUndefinedDeep } from "../lib/firestore_sanitize";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
    req.log.warn(
      { hasUser: Boolean(user) },
      "Unauthorized create lecture attempt"
    );
    return res.code(401).send({
      success: false,
      error: "Unauthorized",
    });
  }

  const { uid } = user;
  const llmFiles = await buildFileUploadsForLLM(data.files);

  const DEFAULT_LECTURE_PREFERENCES: LecturePreferences =
    LecturePreferencesSchema.parse({
      lecture_length: "medium",
      tone: "warm",
      enable_questions: true,
    });

  // Fetch user profile to get saved preferences
  const userProfile = await get_user_profile(uid);
  const savedPreferences =
    userProfile?.preferences ?? DEFAULT_LECTURE_PREFERENCES;

  // Use lecture-specific preferences if provided, otherwise use saved/default preferences
  const userPreferences = data.lecture_preferences ?? savedPreferences;

  const clarifyingRequest = ZGenerateClarifyingQuestionsRequest.parse({
    topic: data.lecture_config.lecture_topic,
    user_preferences: userPreferences,
    custom_preferences: data.lecture_preferences,
  });

  const stub = await create_lecture_stub(uid, userPreferences);
  const questions = await generate_clarifying_questions(
    haikuLlm,
    clarifyingRequest
  );

  ASSET_CACHE.set(stub, {
    uid,
    file_uploads: llmFiles,
    custom_preferences: data.lecture_preferences,
    questions,
    user_preferences: userPreferences,
    lecture_topic: data.lecture_config.lecture_topic,
  });
  return res.code(200).send({
    lecture_id: stub,
    questions,
    success: true,
  } satisfies CreateLectureInitialResponse);
};

export const create_lecture_main: WebsocketHandler = async (ws, req) => {
  // Check for authentication errors from preHandler
  if ((req as any).authError) {
    req.log.error({
      error: (req as any).authError,
    }, '[LectureGen] WebSocket authentication failed');
    ws.send(JSON.stringify({
      success: false,
      error: (req as any).authError,
    }));
    ws.close();
    return;
  }

  if (!req.user) {
    req.log.error('[LectureGen] WebSocket user not authenticated');
    ws.send(JSON.stringify({
      success: false,
      error: "Authentication required",
    }));
    ws.close();
    return;
  }

  const { lecture_id, answers } = req.query as CreateLectureMainRequest;
  const user = req.user;

  req.log.info({
    lecture_id,
    user_id: user.uid,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] WebSocket connection established');

  const cached = ASSET_CACHE.get(lecture_id);
  if (!cached || cached.uid !== user.uid) {
    req.log.error({
      lecture_id,
      user_id: user.uid,
      cached_exists: !!cached,
      uid_match: cached ? cached.uid === user.uid : false,
    }, '[LectureGen] Lecture not found or forbidden');
    ws.send(
      JSON.stringify({
        success: false,
        error: "Lecture not found or forbidden",
      })
    );
    ws.close();
    return;
  }

  req.log.info({
    lecture_id,
    user_id: user.uid,
    topic: cached.lecture_topic,
    answer_count: Array.isArray(answers) ? answers.length : 0,
  }, '[LectureGen] Starting transcript generation');

  const ts = await generate_transcript(llm, {
    ...cached,
    answers,
  });

  req.log.info({
    lecture_id,
    slide_count: ts.length,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] Transcript generation completed');

  ws.send(
    JSON.stringify({
      type: "completedOne",
      completed: "transcript",
    } satisfies CreateLectureStatusUpdate)
  );

  const imageCount = ts.filter((s) => s.image !== undefined).length;
  const diagramCount = ts.filter((s) => s.diagram !== undefined).length;
  const ttsCount = ts.length;

  req.log.info({
    lecture_id,
    images: imageCount,
    diagrams: diagramCount,
    tts: ttsCount,
  }, '[LectureGen] Asset counts enumerated');

  ws.send(
    JSON.stringify({
      type: "enumerated",
      thing: "images",
      total: imageCount,
    } satisfies CreateLectureStatusUpdate)
  );
  ws.send(
    JSON.stringify({
      type: "enumerated",
      thing: "diagrams",
      total: diagramCount,
    } satisfies CreateLectureStatusUpdate)
  );
  ws.send(
    JSON.stringify({
      type: "enumerated",
      thing: "tts",
      total: ttsCount,
    } satisfies CreateLectureStatusUpdate)
  );

  type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
      ? RecursivePartial<U>[]
      : T[P] extends object | undefined
        ? RecursivePartial<T[P]>
        : T[P];
  };

  const lec: RecursivePartial<Lecture> = {
    permitted_users: [user.uid],
    version: 1,
    slides: ts.map(
      (t) =>
        ({
          transcript: t.transcript,
          title: t.slide.title,
          content: t.slide.markdown_body,
          // diagram
          // image
          // voiceover
        }) satisfies Partial<LectureSlide>
    ),
  };

  req.log.info({
    lecture_id,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] Starting parallel asset generation (images, diagrams, TTS)');

  let completedImageCount = 0;
  let completedAudioCount = 0;
  let completedDiagramCount = 0;

  const assetGenerationStart = Date.now();

  const diagramTasks = ts
    .map((s, sidx) => ({ s, sidx }))
    .filter(({ s }) => s.diagram !== undefined)
    .map(({ s, sidx }) =>
      generateMermaidDiagrams(llm, s.diagram!).then((dg) => {
        lec.slides![sidx].diagram = dg;
        const currentCount = ++completedDiagramCount;
        req.log.info({
          lecture_id,
          slide_index: sidx,
          diagram_number: currentCount,
          total_diagrams: diagramCount,
        }, '[LectureGen] Diagram generated');
        ws.send(
          JSON.stringify({
            type: "completedOne",
            completed: "diagrams",
            counter: currentCount,
          } satisfies CreateLectureStatusUpdate)
        );
      })
    );

  // LiveKit image generation currently allows up to 20 concurrent streams.
  // Use a simple limiter to stay within the platform constraints.
  const imageConcurrencyLimit = createLimiter(20);

  const imageTasks = ts
    .map((s, sidx) => ({ s, sidx }))
    .filter(({ s }) => s.image !== undefined)
    .map(({ s, sidx }) =>
      imageConcurrencyLimit(async () => {
        const img = await getImageForKeyword(
          s.image!.search_term,
          s.image!.extended_description
        );
        lec.slides![sidx].image = img;
        const currentCount = ++completedImageCount;
        req.log.info({
          lecture_id,
          slide_index: sidx,
          search_term: s.image!.search_term,
          image_number: currentCount,
          total_images: imageCount,
        }, '[LectureGen] Image fetched');
        ws.send(
          JSON.stringify({
            type: "completedOne",
            completed: "images",
            counter: currentCount,
          } satisfies CreateLectureStatusUpdate)
        );
      })
    );

  const voiceoverTasks = ts.map((s, sidx) =>
    generateAvatarSpeech(s.transcript, {
      metadata: {
        lectureId: lecture_id,
        slideIndex: sidx,
      },
    }).then((speech) => {
      lec.slides![sidx].voiceover = speech.audioUrl;
      const currentCount = ++completedAudioCount;
      req.log.info({
        lecture_id,
        slide_index: sidx,
        audio_number: currentCount,
        total_audio: ttsCount,
      }, '[LectureGen] Voiceover generated');
      ws.send(
        JSON.stringify({
          type: "completedOne",
          completed: "tts",
          counter: currentCount,
        } satisfies CreateLectureStatusUpdate)
      );
    })
  );

  await Promise.all([
    // ALL DA MERMAID DIAGS
    //
    // Old code. This is really sad. I am really sad.
    //
    // generateMermaidDiagrams(
    //   llm,
    //   ts
    //     .map((s, sidx) => ({ s, sidx }))
    //     .filter(({ s }) => s.diagram != undefined)
    //     .map(({ s, sidx }) => ({
    //       type: s.diagram!.type,
    //       extended_description: s.diagram!.extended_description,
    //       slide_num: sidx,
    //     }))
    // ).then((mmds) => {
    //   for (const mmd of mmds) {
    //     lec.slides![Number.parseInt(mmd.slide_number)].diagram = mmd.mermaid;
    //   }
    //   ws.send(
    //     JSON.stringify({
    //       type: "completedOne",
    //       completed: "diagrams",
    //     } satisfies CreateLectureStatusUpdate)
    //   );
    // }),

    ...diagramTasks,
    // ALL DA IMAGES
    ...imageTasks,
    // ALL DA VOICEOVERS
    ...voiceoverTasks,
  ]);

  const assetGenerationDuration = Date.now() - assetGenerationStart;
  req.log.info({
    lecture_id,
    duration_ms: assetGenerationDuration,
    images: completedImageCount,
    diagrams: completedDiagramCount,
    tts: completedAudioCount,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] All assets generated');

  req.log.info({
    lecture_id,
    user_id: user.uid,
  }, '[LectureGen] Saving lecture to Firestore');

  const ld = lectureDoc(lecture_id);
  const sanitizedLecture = stripUndefinedDeep(lec);

  await writeLectureDebugSnapshot(lecture_id, sanitizedLecture);

  await ld.set(sanitizedLecture as Lecture);
  const ud = userProfileDoc(user.uid);
  await ud.update({
    lectures: admin.firestore.FieldValue.arrayUnion(lecture_id),
  });

  req.log.info({
    lecture_id,
    user_id: user.uid,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] Lecture saved to Firestore successfully');

  ws.send(
    JSON.stringify({
      type: "completedAll",
    } satisfies CreateLectureStatusUpdate)
  );

  req.log.info({
    lecture_id,
    timestamp: new Date().toISOString(),
  }, '[LectureGen] Lecture generation completed, closing WebSocket');

  ws.close();
};

async function writeLectureDebugSnapshot(
  lectureId: string,
  payload: unknown
) {
  try {
    const debugDir = path.resolve(process.cwd(), ".debug", "firestore");
    await mkdir(debugDir, { recursive: true });
    const filePath = path.join(
      debugDir,
      `${lectureId}-${Date.now()}-lecture.json`
    );
    const serialized = JSON.stringify(payload, null, 2);
    await writeFile(filePath, serialized, "utf-8");
  } catch (error) {
    console.warn(
      "[LectureGen] Failed to write Firestore debug snapshot:",
      error
    );
  }
}

function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active = Math.max(active - 1, 0);
    const task = queue.shift();
    if (task) {
      task();
    }
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        task()
          .then(resolve)
          .catch(reject)
          .finally(next);
      };

      if (active < limit) {
        run();
      } else {
        queue.push(run);
      }
    });
}
