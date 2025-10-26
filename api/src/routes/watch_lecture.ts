import { WebsocketHandler } from "@fastify/websocket";
import { z } from "zod";
import { lectureDoc } from "../lib/firebase_admin";
import { llm } from "../lib/mouse";
import {
  ZInboundMessage,
  ZGetLectureResponse,
  GetLectureRequest,
  UserQuestionRequest,
  BackendQuestionRequest,
  BackendQuestionResponse,
  GetLectureResponse,
  UserQuestionResponse,
  InboundMessage,
  PartialLecture,
} from "../../../types/index.js";
import { generate_user_question_response } from "../helpers/claude/questions";
import { regenerate_slides_from_question } from "../helpers/claude/regenerate_slides";
import { generateMermaidDiagrams } from "../helpers/claude/mermaid";
import { getImageForKeyword } from "../helpers/image";
import { generateAvatarSpeech } from "../helpers/livekit/tts";
import { uploadVoiceoverDataUrl } from "../helpers/storage/voiceovers";
import { stripUndefinedDeep } from "../lib/firestore_sanitize";
import { LectureSlide } from "schema";

type SessionState =
  | { phase: "waitingForInit" }
  | {
      phase: "ready";
      lectureId: string;
      // cache anything else you want, e.g. loaded lecture data
      // lectureData: Lecture;
    };

export const watch_lecture: WebsocketHandler = async (ws, req) => {
  // send lecture over websocket
  // wait for userinitiatedquestion
  // wait for backendinitiatedquestion

  // start locked until client sends ZGetLecture
  let state: SessionState = { phase: "waitingForInit" };

  function send(obj: unknown) {
    ws.send(JSON.stringify(obj));
  }

  async function handleGetLecture(msg: GetLectureRequest) {
    if (state.phase !== "waitingForInit") {
      send({
        success: false,
        error: "already_initialized",
      });
      ws.close();
      return;
    }

    // Fetch/validate lecture
    const lectureId = msg.lecture_id;
    const lectureData = await lectureDoc(lectureId)
      .get()
      .then((d) => d.data());

    if (!lectureData) {
      send({
        success: false,
        error: "lecture_not_found",
        lecture_id: lectureId,
      });
      ws.close();
      return;
    }

    // Validate lecture data matches schema before sending
    const response = {
      type: "get_lecture_response" as const,
      lecture: lectureData,
    };

    const validation = ZGetLectureResponse.safeParse(response);
    if (!validation.success) {
      console.error(
        "[watch_lecture] Lecture data validation failed:",
        z.treeifyError(validation.error)
      );
      send({
        success: false,
        error: "invalid_lecture_data",
        lecture_id: lectureId,
        details: z.treeifyError(validation.error),
      });
      ws.close();
      return;
    }

    // Move to ready state
    state = {
      phase: "ready",
      lectureId,
      // lectureData,
    };

    // Send validated lecture snapshot back to client
    send(validation.data);
  }

  async function handleUserInitiatedRequest(msg: UserQuestionRequest) {
    if (state.phase !== "ready") {
      send({
        type: "error",
        error: "not_initialized must send get_lecture first",
      });
      ws.close();
      return;
    }

    // Analyze the user's question
    let result;
    try {
      result = await generate_user_question_response(llm, msg);
    } catch (error) {
      req.log.error(
        {
          lecture_id: msg.lecture_id,
          error: error instanceof Error ? error.message : String(error),
        },
        "[watch_lecture] Failed to analyze user question"
      );
      send({
        type: "error",
        error: "Failed to analyze question. Please try again.",
      });
      return;
    }

    // Check if we need to regenerate slides
    if (result.answer_category === "regenerate_slides") {
      req.log.info(
        {
          lecture_id: msg.lecture_id,
          current_slide: msg.current_slide,
          question: msg.question,
        },
        "[watch_lecture] Regenerating slides based on user question"
      );

      // Fetch the current lecture data
      const lectureData = await lectureDoc(msg.lecture_id)
        .get()
        .then((d) => d.data());

      if (!lectureData) {
        send({
          type: "error",
          error: "lecture_not_found",
        });
        return;
      }

      // Use default preferences for regeneration
      const userPreferences = {
        lecture_length: "medium" as const,
        tone: "warm" as const,
        enable_questions: true,
      };

      // Generate new slides
      let newSlideData;
      try {
        newSlideData = await regenerate_slides_from_question(llm, {
          lecture_topic: lectureData.topic,
          previous_slides: lectureData.slides,
          current_slide_index: msg.current_slide,
          user_question: msg.question,
          regeneration_instructions: result.instructions,
          user_preferences: userPreferences,
        });
      } catch (error) {
        req.log.error(
          {
            lecture_id: msg.lecture_id,
            error: error instanceof Error ? error.message : String(error),
          },
          "[watch_lecture] Failed to regenerate slides - falling back to simple answer"
        );

        // Fall back to just sending the response without regeneration
        send({
          type: "user_question_response",
          response: {
            answer_category: "simple",
            response:
              result.response +
              " (Note: Attempted to regenerate slides but encountered an error. Please ask your question again or try rephrasing it.)",
          },
        } satisfies UserQuestionResponse);
        return;
      }

      req.log.info(
        {
          lecture_id: msg.lecture_id,
          new_slide_count: newSlideData.length,
        },
        "[watch_lecture] New slides generated, starting asset generation"
      );

      // Build new slides with initial data
      type RecursivePartial<T> = {
        [P in keyof T]?: T[P] extends (infer U)[]
          ? RecursivePartial<U>[]
          : T[P] extends object | undefined
            ? RecursivePartial<T[P]>
            : T[P];
      };

      const newSlides: RecursivePartial<LectureSlide>[] = newSlideData.map(
        (t) =>
          ({
            transcript: t.transcript,
            title: t.slide.title,
            content: t.slide.markdown_body,
          }) as Partial<LectureSlide>
      );

      // Generate assets for new slides (images, diagrams, TTS)
      const imageCount = newSlideData.filter(
        (s) => s.image !== undefined
      ).length;
      const diagramCount = newSlideData.filter(
        (s) => s.diagram !== undefined
      ).length;

      // Generate diagrams
      const diagramTasks = newSlideData
        .map((s, sidx) => ({ s, sidx }))
        .filter(({ s }) => s.diagram !== undefined)
        .map(({ s, sidx }) =>
          generateMermaidDiagrams(llm, s.diagram!).then((dg) => {
            newSlides[sidx].diagram = dg;
            req.log.info(
              {
                lecture_id: msg.lecture_id,
                slide_index: sidx,
              },
              "[watch_lecture] Diagram generated for regenerated slide"
            );
          })
        );

      // Generate images (with concurrency limit)
      const imageConcurrencyLimit = createLimiter(15);
      const imageTasks = newSlideData
        .map((s, sidx) => ({ s, sidx }))
        .filter(({ s }) => s.image !== undefined)
        .map(({ s, sidx }) =>
          imageConcurrencyLimit(async () => {
            const img = await getImageForKeyword(
              s.image!.search_term,
              s.image!.extended_description
            );
            newSlides[sidx].image = img;
            req.log.info(
              {
                lecture_id: msg.lecture_id,
                slide_index: sidx,
              },
              "[watch_lecture] Image generated for regenerated slide"
            );
          })
        );

      // Generate voiceovers
      const voiceoverTasks = newSlideData.map((s, sidx) =>
        generateAvatarSpeech(s.transcript, {
          format: "wav",
          metadata: {
            lectureId: msg.lecture_id,
            slideIndex: msg.current_slide + 1 + sidx,
          },
        }).then(async (speech) => {
          let resolvedAudioUrl = speech.audioUrl;

          if (resolvedAudioUrl?.startsWith("data:")) {
            try {
              const upload = await uploadVoiceoverDataUrl({
                dataUrl: resolvedAudioUrl,
                lectureId: msg.lecture_id,
                slideIndex: msg.current_slide + 1 + sidx,
                customMetadata: {
                  requestId: speech.requestId ?? undefined,
                },
                cacheControl: "public,max-age=31536000,immutable",
              });
              resolvedAudioUrl = upload.signedUrl;
              req.log.info(
                {
                  lecture_id: msg.lecture_id,
                  slide_index: sidx,
                },
                "[watch_lecture] Voiceover persisted for regenerated slide"
              );
            } catch (persistError) {
              req.log.error(
                {
                  lecture_id: msg.lecture_id,
                  slide_index: sidx,
                  error:
                    persistError instanceof Error
                      ? persistError.message
                      : persistError,
                },
                "[watch_lecture] Failed to persist voiceover"
              );
            }
          }

          if (resolvedAudioUrl) {
            newSlides[sidx].audio_transcription_link = resolvedAudioUrl;
          }

          req.log.info(
            {
              lecture_id: msg.lecture_id,
              slide_index: sidx,
            },
            "[watch_lecture] Voiceover generated for regenerated slide"
          );
        })
      );

      // Wait for all assets to be generated
      await Promise.all([...diagramTasks, ...imageTasks, ...voiceoverTasks]);

      req.log.info(
        {
          lecture_id: msg.lecture_id,
          images: imageCount,
          diagrams: diagramCount,
        },
        "[watch_lecture] All assets generated for regenerated slides"
      );

      // Update the lecture in Firebase
      const updatedSlides = [
        ...lectureData.slides.slice(0, msg.current_slide + 1),
        ...(stripUndefinedDeep(newSlides) as LectureSlide[]),
      ];

      await lectureDoc(msg.lecture_id).update({
        slides: updatedSlides,
      });

      req.log.info(
        {
          lecture_id: msg.lecture_id,
          total_slides: updatedSlides.length,
        },
        "[watch_lecture] Lecture updated in Firestore with regenerated slides"
      );

      // Send response with partial lecture
      const partialLecture: PartialLecture = {
        from_slide: msg.current_slide + 1,
        slides: stripUndefinedDeep(newSlides) as LectureSlide[],
      };

      send({
        type: "user_question_response",
        response: result,
        partial_lecture: partialLecture,
      } satisfies UserQuestionResponse);
    } else {
      // Simple answer - no regeneration needed
      send({
        type: "user_question_response",
        response: result,
      } satisfies UserQuestionResponse);
    }
  }

  //   async function handleBackendInitiatedQuestion(msg: BackendQuestionRequest) {
  //     if (state.phase !== "ready") {
  //       send({
  //         success: false,
  //         error: "not_initialized must send get_lecture first",
  //       });
  //       ws.close();
  //       return;
  //     }

  //     // // Do whatever "eventB" used to mean.
  //     // // This might be e.g. "server is asking client something"
  //     // // or "client is acknowledging a question from server"
  //     // const result = await processBackendInitiatedQuestion(state.lectureId, msg);

  //     // send({
  //     //   type: "backend_question_response",
  //     //   ...result,
  //     // } as BackendQuestionResponse);
  //   }

  ws.on("message", async (raw) => {
    // 1. parse JSON
    let parsed: InboundMessage;
    try {
      const json = JSON.parse(raw.toString());
      const check = ZInboundMessage.safeParse(json);
      if (!check.success) {
        send({
          type: "error",
          error: "bad_request" + z.treeifyError(check.error),
        });
        return;
      }
      parsed = check.data;
    } catch {
      send({ type: "error", error: "invalid_json" });
      return;
    }

    // 2. dispatch by discriminant
    switch (parsed.type) {
      case "get_lecture_request":
        await handleGetLecture(parsed);
        break;

      case "user_question_request":
        await handleUserInitiatedRequest(parsed);
        break;

      //   case "backend_question_request":
      //     await handleBackendInitiatedQuestion(parsed);
      //     break;

      //   default: {
      //     // compile-time exhaustiveness guard
      //     const _exhaustive: never = parsed;
      //     void _exhaustive;
      //   }
    }
  });

  ws.on("close", () => {
    // any cleanup, metrics, unsubscribe, etc.
  });
};

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
