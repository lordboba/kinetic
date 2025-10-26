import { WebsocketHandler } from "@fastify/websocket";
import { z } from "zod";
import { lectureDoc } from "../lib/firebase_admin";
import { llm } from "../lib/mouse";
import {
  ZInboundMessage,
  GetLectureRequest,
  UserQuestionRequest,
  BackendQuestionRequest,
  BackendQuestionResponse,
  GetLectureResponse,
  UserQuestionResponse,
  InboundMessage,
} from "schema/zod_types";
import { generate_user_question_response } from "../helpers/claude/questions";

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

    // Move to ready state
    state = {
      phase: "ready",
      lectureId,
      // lectureData,
    };

    // Send initial lecture snapshot back to client
    send({
      type: "get_lecture_response",
      lecture: lectureData,
    } satisfies GetLectureResponse);
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

    // Do whatever "eventA" used to mean, now interpreted as
    // a client-driven request after initialization.
    const result = await generate_user_question_response(llm, msg);

    send({
      type: "user_question_response",
      response: result,
    } satisfies UserQuestionResponse);
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
