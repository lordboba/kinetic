import { RouteHandler } from "fastify";
import {
  CreateLectureUploadSchema,
  LecturePreferencesSchema,
} from "../schemas/create-lecture.js";
import { buildFileUploadsForLLM } from "../helpers/file/index.js";
import { ASSET_CACHE } from "../lib/file_cache.js";
import * as z from "zod";
import {
  get_user_profile,
  create_lecture_stub,
  userProfileDoc,
  lectureDoc,
  admin,
} from "../lib/firebase_admin.js";
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
} from "../helpers/claude/clarifying_questions.js";
import { llm, haikuLlm } from "../lib/mouse.js";
import { WebsocketHandler } from "@fastify/websocket";
import { generate_transcript } from "../helpers/claude/transcript.js";
import { generateMermaidDiagrams, type GenerateMermaidRequest } from "../helpers/claude/mermaid.js";
import { getImageForKeyword } from "../helpers/image/index.js";
import { generateAvatarSpeech } from "../helpers/livekit/tts.js";
import type { TtsStreamChunk } from "../helpers/livekit/tts-avatar.js";
import { stripUndefinedDeep } from "../lib/firestore_sanitize.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadVoiceoverDataUrl } from "../helpers/storage/voiceovers.js";
import { lectureAudioStreamBroker } from "../lib/lecture_audio_stream.js";

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
    req.log.error(
      {
        error: (req as any).authError,
      },
      "[LectureGen] WebSocket authentication failed"
    );
    ws.send(
      JSON.stringify({
        success: false,
        error: (req as any).authError,
      })
    );
    ws.close();
    return;
  }

  if (!req.user) {
    req.log.error("[LectureGen] WebSocket user not authenticated");
    ws.send(
      JSON.stringify({
        success: false,
        error: "Authentication required",
      })
    );
    ws.close();
    return;
  }

  const {
    lecture_id,
    answers,
    augment_slides_instructions,
    supports_streaming_audio,
  } = req.query as CreateLectureMainRequest;
  const supportsStreamingAudio =
    supports_streaming_audio === "1" ||
    supports_streaming_audio === "true" ||
    supports_streaming_audio === true;
  const user = req.user;

  req.log.info(
    {
      lecture_id,
      user_id: user.uid,
      timestamp: new Date().toISOString(),
    },
    "[LectureGen] WebSocket connection established"
  );

  const cached = ASSET_CACHE.get(lecture_id);
  if (!cached || cached.uid !== user.uid) {
    req.log.error(
      {
        lecture_id,
        user_id: user.uid,
        cached_exists: !!cached,
        uid_match: cached ? cached.uid === user.uid : false,
      },
      "[LectureGen] Lecture not found or forbidden"
    );
    ws.send(
      JSON.stringify({
        success: false,
        error: "Lecture not found or forbidden",
      })
    );
    ws.close();
    return;
  }

  req.log.info(
    {
      lecture_id,
      user_id: user.uid,
      topic: cached.lecture_topic,
      answer_count: Array.isArray(answers) ? answers.length : 0,
    },
    "[LectureGen] Starting transcript generation"
  );

  let ts;
  try {
    ts = await generate_transcript(
      haikuLlm,
      {
        ...cached,
        answers,
      },
      augment_slides_instructions
    );

    if (!ts || ts.length === 0) {
      throw new Error("Transcript generation returned empty or invalid slides");
    }

    req.log.info(
      {
        lecture_id,
        slide_count: ts.length,
        timestamp: new Date().toISOString(),
      },
      "[LectureGen] Transcript generation completed"
    );
  } catch (error) {
    req.log.error(
      {
        lecture_id,
        user_id: user.uid,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[LectureGen] Transcript generation failed - cache preserved for retry"
    );

    // Keep the cache entry so user can retry
    // ASSET_CACHE is NOT deleted here - it remains for retry

    ws.send(
      JSON.stringify({
        success: false,
        error: "transcript_generation_failed",
        message: error instanceof Error ? error.message : "Failed to generate lecture transcript",
        lecture_id,
        can_retry: true,
        details: "Your questionnaire responses have been saved. You can retry generating the lecture.",
      })
    );
    ws.close();
    return;
  }

  ws.send(
    JSON.stringify({
      type: "completedOne",
      completed: "transcript",
    } satisfies CreateLectureStatusUpdate)
  );

  const imageCount = ts.filter((s) => s.image !== undefined).length;
  const diagramCount = ts.filter((s) => s.diagram !== undefined).length;
  const ttsCount = ts.length;

  req.log.info(
    {
      lecture_id,
      images: imageCount,
      diagrams: diagramCount,
      tts: ttsCount,
    },
    "[LectureGen] Asset counts enumerated"
  );

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

  if (!supportsStreamingAudio) {
    ws.send(
      JSON.stringify({
        type: "enumerated",
        thing: "tts",
        total: ttsCount,
      } satisfies CreateLectureStatusUpdate)
    );
  }

  type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
      ? RecursivePartial<U>[]
      : T[P] extends object | undefined
        ? RecursivePartial<T[P]>
        : T[P];
  };

  const lec: RecursivePartial<Lecture> = {
    permitted_users: [user.uid],
    version: supportsStreamingAudio ? 2 : 1,
    topic: cached.lecture_topic,
    slides: ts.map(
      (t) =>
        ({
          transcript: t.transcript,
          title: t.slide.title,
          content: t.slide.markdown_body,
          // diagram
          // image
          // audio_transcription_link
        }) satisfies Partial<LectureSlide>
    ),
  };

  req.log.info(
    {
      lecture_id,
      timestamp: new Date().toISOString(),
    },
    "[LectureGen] Starting parallel asset generation (images, diagrams, TTS)"
  );

  let completedImageCount = 0;
  let completedAudioCount = 0;
  let completedDiagramCount = 0;

  const assetGenerationStart = Date.now();

  const diagramTasks = ts
    .map((s, sidx) => ({ s, sidx }))
    .filter(({ s }) => s.diagram !== undefined && s.diagram.type !== undefined)
    .map(({ s, sidx }) =>
      generateMermaidDiagrams(llm, s.diagram! as GenerateMermaidRequest).then((dg) => {
        lec.slides![sidx].diagram = dg;
        const currentCount = ++completedDiagramCount;
        req.log.info(
          {
            lecture_id,
            slide_index: sidx,
            diagram_number: currentCount,
            total_diagrams: diagramCount,
          },
          "[LectureGen] Diagram generated"
        );
        ws.send(
          JSON.stringify({
            type: "completedOne",
            completed: "diagrams",
            counter: currentCount,
          } satisfies CreateLectureStatusUpdate)
        );
      })
    );

  // LiveKit image generation currently allows up to 3 concurrent streams.
  // Use a simple limiter to stay within the platform constraints.
  const imageConcurrencyLimit = createLimiter(3);

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
        req.log.info(
          {
            lecture_id,
            slide_index: sidx,
            search_term: s.image!.search_term,
            image_number: currentCount,
            total_images: imageCount,
          },
          "[LectureGen] Image fetched"
        );
        ws.send(
          JSON.stringify({
            type: "completedOne",
            completed: "images",
            counter: currentCount,
          } satisfies CreateLectureStatusUpdate)
        );
      })
    );

  let resolveLecturePersisted: (() => void) | null = null;
  const lecturePersisted = new Promise<void>((resolve) => {
    resolveLecturePersisted = resolve;
  });

  const STREAM_READY_BUFFER_MS = 2_000;

  const voiceoverTasks = ts.map(async (s, sidx) => {
    let chunkIndex = 0;
    let bufferedMs = 0;
    lectureAudioStreamBroker.publishStatus({
      type: "slide_audio_status",
      lecture_id,
      slide_index: sidx,
      status: "started",
    });

      const handleChunk = async (chunk: TtsStreamChunk) => {
        if (!chunk.frame) {
          return;
        }

        chunkIndex += 1;
        const pcmBuffer = Buffer.from(
          chunk.frame.data.buffer,
          chunk.frame.data.byteOffset,
          chunk.frame.data.byteLength
        );

        lectureAudioStreamBroker.publishChunk({
          type: "slide_audio_chunk",
          lecture_id,
          slide_index: sidx,
          chunk_index: chunkIndex,
          sample_rate: chunk.frame.sampleRate,
          channels: chunk.frame.channels,
          samples_per_channel: chunk.frame.samplesPerChannel,
          pcm16: pcmBuffer,
          transcript_delta: chunk.deltaText?.trim() ? chunk.deltaText : undefined,
        });

      const chunkDurationMs =
        (chunk.frame.samplesPerChannel / chunk.frame.sampleRate) * 1000;
      bufferedMs += chunkDurationMs;
      lectureAudioStreamBroker.publishBuffer({
        type: "slide_audio_buffer",
        lecture_id,
        slide_index: sidx,
        chunk_index: chunkIndex,
        buffered_ms: Math.round(bufferedMs),
        ready_to_advance: bufferedMs >= STREAM_READY_BUFFER_MS,
      });
    };

    try {
      const speech = await generateAvatarSpeech(
        s.transcript,
        {
          format: "wav",
          metadata: {
            lectureId: lecture_id,
            slideIndex: sidx,
          },
        },
        {
          onChunk: handleChunk,
        }
      );

      let resolvedAudioUrl = speech.audioUrl;

      if (resolvedAudioUrl?.startsWith("data:")) {
        try {
          const upload = await uploadVoiceoverDataUrl({
            dataUrl: resolvedAudioUrl,
            lectureId: lecture_id,
            slideIndex: sidx,
            customMetadata: {
              requestId: speech.requestId ?? undefined,
            },
            cacheControl: "public,max-age=31536000,immutable",
          });
          resolvedAudioUrl = upload.signedUrl;
          req.log.info(
            {
              lecture_id,
              slide_index: sidx,
              storage_path: upload.storagePath,
            },
            "[LectureGen] Voiceover data URL persisted to storage"
          );
        } catch (persistError) {
          req.log.error(
            {
              lecture_id,
              slide_index: sidx,
              error:
                persistError instanceof Error
                  ? persistError.message
                  : persistError,
            },
            "[LectureGen] Failed to persist voiceover data URL; falling back to inline data"
          );
        }
      }

      if (resolvedAudioUrl) {
        lec.slides![sidx].audio_transcription_link = resolvedAudioUrl;
        try {
          await lecturePersisted;
          await lectureDoc(lecture_id).update({
            [`slides.${sidx}.audio_transcription_link`]: resolvedAudioUrl,
          });
        } catch (updateError) {
          req.log.error(
            {
              lecture_id,
              slide_index: sidx,
              error:
                updateError instanceof Error
                  ? updateError.message
                  : updateError,
            },
            "[LectureGen] Failed to persist voiceover link"
          );
        }
      }

      lectureAudioStreamBroker.publishStatus({
        type: "slide_audio_status",
        lecture_id,
        slide_index: sidx,
        status: "completed",
        audio_url: resolvedAudioUrl,
      });

      lectureAudioStreamBroker.publishBuffer({
        type: "slide_audio_buffer",
        lecture_id,
        slide_index: sidx,
        chunk_index: chunkIndex,
        buffered_ms: Math.round(bufferedMs),
        ready_to_advance: true,
        is_complete: true,
      });

      const currentCount = ++completedAudioCount;
      req.log.info(
        {
          lecture_id,
          slide_index: sidx,
          audio_number: currentCount,
          total_audio: ttsCount,
        },
        "[LectureGen] Voiceover generated"
      );

      if (!supportsStreamingAudio) {
        ws.send(
          JSON.stringify({
            type: "completedOne",
            completed: "tts",
            counter: currentCount,
          } satisfies CreateLectureStatusUpdate)
        );
      }
    } catch (error) {
      lectureAudioStreamBroker.publishStatus({
        type: "slide_audio_status",
        lecture_id,
        slide_index: sidx,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      lectureAudioStreamBroker.publishBuffer({
        type: "slide_audio_buffer",
        lecture_id,
        slide_index: sidx,
        chunk_index: chunkIndex,
        buffered_ms: Math.round(bufferedMs),
        ready_to_advance: bufferedMs >= STREAM_READY_BUFFER_MS,
      });
      req.log.error(
        {
          lecture_id,
          slide_index: sidx,
          error: error instanceof Error ? error.message : error,
        },
        "[LectureGen] Voiceover generation failed"
      );
    }
  });

  await Promise.all([
    ...diagramTasks, // Diagram Tasks
    ...imageTasks, // Image Tasks
  ]);

  if (supportsStreamingAudio) {
    void Promise.allSettled(voiceoverTasks).then((results) => {
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        req.log.warn(
          {
            lecture_id,
            failures: failures.length,
          },
          "[LectureGen] Some voiceover tasks failed after lecture completion"
        );
      }
    });
  } else {
    await Promise.all(voiceoverTasks);
  }

  const assetGenerationDuration = Date.now() - assetGenerationStart;
  const pendingVoiceovers = supportsStreamingAudio
    ? Math.max(ttsCount - completedAudioCount, 0)
    : 0;
  req.log.info(
    {
      lecture_id,
      duration_ms: assetGenerationDuration,
      images: completedImageCount,
      diagrams: completedDiagramCount,
      tts_completed: completedAudioCount,
      tts_pending: pendingVoiceovers,
      timestamp: new Date().toISOString(),
    },
    pendingVoiceovers > 0
      ? "[LectureGen] Visual assets generated; voiceovers streaming async"
      : "[LectureGen] All assets generated"
  );

  req.log.info(
    {
      lecture_id,
      user_id: user.uid,
    },
    "[LectureGen] Saving lecture to Firestore"
  );

  const ld = lectureDoc(lecture_id);
  const sanitizedLecture = stripUndefinedDeep(lec);

  await writeLectureDebugSnapshot(lecture_id, sanitizedLecture);

  await ld.set(sanitizedLecture as Lecture);
  const ud = userProfileDoc(user.uid);
  await ud.update({
    lectures: admin.firestore.FieldValue.arrayUnion(lecture_id),
  });
  resolveLecturePersisted?.();

  req.log.info(
    {
      lecture_id,
      user_id: user.uid,
      timestamp: new Date().toISOString(),
    },
    "[LectureGen] Lecture saved to Firestore successfully"
  );

  ws.send(
    JSON.stringify({
      type: "completedAll",
    } satisfies CreateLectureStatusUpdate)
  );

  req.log.info(
    {
      lecture_id,
      timestamp: new Date().toISOString(),
    },
    "[LectureGen] Lecture generation completed, closing WebSocket"
  );

  ws.close();
};

async function writeLectureDebugSnapshot(lectureId: string, payload: unknown) {
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
        task().then(resolve).catch(reject).finally(next);
      };

      if (active < limit) {
        run();
      } else {
        queue.push(run);
      }
    });
}
