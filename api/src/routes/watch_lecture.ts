import { WebsocketHandler } from "@fastify/websocket";
import { z } from "zod";
import { lectureDoc } from "../lib/firebase_admin.js";
import { llm } from "../lib/mouse.js";
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
import { generate_user_question_response } from "../helpers/claude/questions.js";
import { regenerate_slides_from_question } from "../helpers/claude/regenerate_slides.js";
import { generateMermaidDiagrams } from "../helpers/claude/mermaid.js";
import { getImageForKeyword } from "../helpers/image/index.js";
import { generateAvatarSpeech } from "../helpers/livekit/tts.js";
import { uploadVoiceoverDataUrl } from "../helpers/storage/voiceovers.js";
import { stripUndefinedDeep } from "../lib/firestore_sanitize.js";
import { LectureSlide } from "schema";
import type { TtsStreamChunk } from "../helpers/livekit/tts-avatar.js";
import { lectureAudioStreamBroker } from "../lib/lecture_audio_stream.js";

type SessionState =
  | { phase: "waitingForInit" }
  | {
      phase: "ready";
      lectureId: string;
      audioStreamingEnabled: boolean;
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
    let lectureData = await lectureDoc(lectureId)
      .get()
      .then((d) => d.data());

    if (lectureData?.slides) {
      let slidesArray: unknown[];
      if (Array.isArray(lectureData.slides)) {
        slidesArray = lectureData.slides as unknown[];
      } else if (typeof lectureData.slides === "object") {
        slidesArray = Object.keys(lectureData.slides)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => lectureData.slides[key]);
      } else {
        slidesArray = [];
      }

      const normalizedSlides = slidesArray.map((raw, index) => {
        const candidate = (raw ?? {}) as Record<string, unknown>;
        const slideBlock =
          candidate && typeof candidate.slide === "object" && candidate.slide !== null
            ? (candidate.slide as Record<string, unknown>)
            : {};

        const transcript =
          typeof candidate.transcript === "string"
            ? (candidate.transcript as string)
            : typeof slideBlock.transcript === "string"
              ? (slideBlock.transcript as string)
              : typeof candidate.text === "string"
                ? (candidate.text as string)
                : "";

        const title =
          typeof candidate.title === "string"
            ? (candidate.title as string)
            : typeof slideBlock.title === "string"
              ? (slideBlock.title as string)
              : `Slide ${index + 1}`;

        const content =
          typeof candidate.content === "string"
            ? (candidate.content as string)
            : typeof slideBlock.markdown_body === "string"
              ? (slideBlock.markdown_body as string)
              : undefined;

        const audioLink =
          typeof candidate.audio_transcription_link === "string"
            ? (candidate.audio_transcription_link as string)
            : typeof candidate.audio_url === "string"
              ? (candidate.audio_url as string)
              : undefined;

        return {
          transcript,
          title,
          content,
          diagram:
            typeof candidate.diagram === "string"
              ? (candidate.diagram as string)
              : typeof slideBlock.diagram === "string"
                ? (slideBlock.diagram as string)
                : undefined,
          image:
            typeof candidate.image === "string"
              ? (candidate.image as string)
              : typeof slideBlock.image === "string"
                ? (slideBlock.image as string)
                : undefined,
          question:
            typeof candidate.question === "string"
              ? (candidate.question as string)
              : undefined,
          audio_transcription_link: audioLink,
        } satisfies LectureSlide;
      });

      lectureData = {
        ...lectureData,
        slides: normalizedSlides,
      };
    }

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
      const details = z.treeifyError(validation.error);
      console.error(
        "[watch_lecture] Lecture data validation failed, forwarding raw snapshot:",
        JSON.stringify(details, null, 2)
      );
    }

    // Move to ready state
    const audioStreamingEnabled =
      msg.capabilities?.audio_streaming === true;

    state = {
      phase: "ready",
      lectureId,
      audioStreamingEnabled,
      // lectureData,
    };

    // Send lecture snapshot back to client (validated when possible)
    send(validation.success ? validation.data : response);

    lectureAudioStreamBroker.addSubscriber(lectureId, ws, {
      acceptsChunks: audioStreamingEnabled,
    });
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
      const STREAM_READY_BUFFER_MS = 2_000;

      const voiceoverTasks = newSlideData.map(async (s, sidx) => {
        const absoluteSlideIndex = msg.current_slide + 1 + sidx;
        let chunkIndex = 0;
        let bufferedMs = 0;

        lectureAudioStreamBroker.publishStatus({
          type: "slide_audio_status",
          lecture_id: msg.lecture_id,
          slide_index: absoluteSlideIndex,
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
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
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
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
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
                lectureId: msg.lecture_id,
                slideIndex: absoluteSlideIndex,
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
                lectureId: msg.lecture_id,
                slideIndex: absoluteSlideIndex,
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
            try {
              await lectureDoc(msg.lecture_id).update({
                [`slides.${absoluteSlideIndex}.audio_transcription_link`]:
                  resolvedAudioUrl,
              });
            } catch (updateError) {
              req.log.error(
                {
                  lecture_id: msg.lecture_id,
                  slide_index: absoluteSlideIndex,
                  error:
                    updateError instanceof Error
                      ? updateError.message
                      : updateError,
                },
                "[watch_lecture] Failed to persist regenerated voiceover link"
              );
            }
          }

          lectureAudioStreamBroker.publishStatus({
            type: "slide_audio_status",
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
            status: "completed",
            audio_url: resolvedAudioUrl,
          });

          lectureAudioStreamBroker.publishBuffer({
            type: "slide_audio_buffer",
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
            chunk_index: chunkIndex,
            buffered_ms: Math.round(bufferedMs),
            ready_to_advance: true,
            is_complete: true,
          });

          req.log.info(
            {
              lecture_id: msg.lecture_id,
              slide_index: sidx,
            },
            "[watch_lecture] Voiceover generated for regenerated slide"
          );
        } catch (error) {
          lectureAudioStreamBroker.publishStatus({
            type: "slide_audio_status",
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
          lectureAudioStreamBroker.publishBuffer({
            type: "slide_audio_buffer",
            lecture_id: msg.lecture_id,
            slide_index: absoluteSlideIndex,
            chunk_index: chunkIndex,
            buffered_ms: Math.round(bufferedMs),
            ready_to_advance: bufferedMs >= STREAM_READY_BUFFER_MS,
          });
          req.log.error(
            {
              lecture_id: msg.lecture_id,
              slide_index: absoluteSlideIndex,
              error: error instanceof Error ? error.message : error,
            },
            "[watch_lecture] Voiceover generation failed for regenerated slide"
          );
        }
      });

      // Wait for diagrams and images; voiceovers stream independently
      await Promise.all([...diagramTasks, ...imageTasks]);

      void Promise.allSettled(voiceoverTasks).then((results) => {
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          req.log.warn(
            {
              lecture_id: msg.lecture_id,
              failures: failures.length,
            },
            "[watch_lecture] Some regenerated slide voiceovers failed"
          );
        }
      });

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
