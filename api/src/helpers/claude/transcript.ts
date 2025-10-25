import * as z from "zod";
import { LLM, StringAccumulator } from "./llm.js";
import {
  CreateLectureAnswer,
  CreateLectureQuestion,
  FileUpload,
  LecturePreferences,
} from "schema";

export type GenerateTranscriptRequest = {
  lecture_topic: string;
  file_uploads: FileUpload[]; // must be pdf2text'd
  questions: CreateLectureQuestion[];
  answers: CreateLectureAnswer[];
  user_preferences: LecturePreferences;
  custom_preferences?: LecturePreferences;
};

// validates AI's response structure 
export const ZGenerateTranscriptResponse = z.array(
  z.object({
    transcript: z.string(),
    question: z.optional(
      z.object({
        question_text: z.string(),
        suggested_answer: z.string(),
      })
    ),
    image: z.optional(
      z.object({
        search_term: z.string(),
        extended_description: z.string(),
      })
    ),
    diagram: z.optional(
      z.object({
        type: z.union([
          z.literal("flowchart-LR"),
          z.literal("flowchart-RL"),
          z.literal("flowchart-TB"),
          z.literal("flowchart-BT"),
          z.literal("sequenceDiagram"),
          z.literal("classDiagram"),
          z.literal("stateDiagram-v2"),
          z.literal("erDiagram"),
          z.literal("pie"),
        ]),
        extended_description: z.string(),
      })
    ),
  })
);

// converts Q&A pairs into readable text format 
const question_answer_to_text = (
  question: CreateLectureQuestion,
  answer: CreateLectureAnswer
) => {
  let qn_type;
  switch (question.question_type) {
    case "checkbox":
      qn_type = "Multiple Choice";
    case "radio":
      qn_type = "Single Select";
    case "text_input":
      qn_type = "Open Ended";
  }
  let acc = new StringAccumulator(`${qn_type} Q: ${question.question}`);
  if (question.question_type != "text_input") {
    acc.add("Possible options:");
    for (const opt of question.options) {
      acc.add(opt.text);
    }
  }
  acc.add(`A: ${answer.answer}`); // backend should validate earlier that id matches (oneof) qn opt ids
  return acc.collect();
};

export async function generate_transcript(
  llm: LLM,
  generate_transcript_request: GenerateTranscriptRequest
) {
  const {
    lecture_topic,
    file_uploads,
    questions,
    answers,
    user_preferences,
    custom_preferences,
  } = generate_transcript_request;

  const effective_preferences = Object.assign(
    user_preferences,
    custom_preferences
  );

  // debug_assert_eq(questions.len(), answers.len())

  const PROMPT = `
You are an expert lecturer being asked to lecture on the following: ${lecture_topic}.
You have asked the following clarifying questions and have been given the following answers:

${questions.map((qn, qidx) => question_answer_to_text(qn, answers[qidx])).join("\n\n")}

You have also been given the following context. Please reference this context to ground your response, including quotes where necessary. Do not wrap the context in quotes; pretend as if the content you have written is yours and reference it freely.

${file_uploads.map((u) => `**${u.name}**\n${u.content}`)}

Please generate a response as follows:
Each object in the returned array will represent a single **slide** in a lecture-style presentation. The \`transcript\` field corresponds to the spoken narration or written content that would appear on that slide. Optional \`image\`, \`diagram\`, and \`question\` fields should be used only when they enhance the educational value of that specific slide. The goal is to produce a structured lecture that could be seamlessly rendered into a sequence of slides, each containing its own transcript (and optionally a visual or question) as teaching material.

Return a JSON array. Each element of the array must be an object with the following structure:
{
  "transcript": string, // REQUIRED, plain text transcript for this segment
  "question": {
    "question_text": string, // REQUIRED if question is present; the question you want the learner to answer
    "suggested_answer": string // REQUIRED if question is present; the correct/expected answer
  },
  "image": {
    "search_term": string, // short phrase suitable for image search
    "extended_description": string, // longer 1-2 sentence caption-like description of what the image should depict
  },
  "diagram": {
    "type": "flowchart-LR" | "flowchart-RL" | "flowchart-TB" | "flowchart-BT" | "sequenceDiagram" | "classDiagram" | "stateDiagram-v2" | "erDiagram" | "pie" // mermaid flowchart type,
    "extended_description": string // detailed description of what the diagram should show
  }
}

Please adhere to the following guidelines:
- \`transcript\` is **always required**.
- \`question\` is **optional**. Include it only if this part of the transcript naturally invites an in-lecture check-for-understanding. If included, it must contain both \`question_text\` and \`suggested_answer\`.
- Either \`image\` **or** \`diagram\` may be included for each transcript segment — never both. It is also acceptable for a segment to include neither if a visual aid would not add clarity.
- \`image\` is **optional**, but if included it must contain both \`search_term\` and \`extended_description\`.
- \`diagram\` is **optional**, but if included:
  - It must contain both \`type\` and \`extended_description\`.
  - The \`type\` must be exactly one of the following:
    - \`"flowchart-LR"\`, \`"flowchart-RL"\`, \`"flowchart-TB"\`, \`"flowchart-BT"\` — **Flowcharts** visualize process flow or logical branching. Nodes (geometric shapes) represent steps, and edges (arrows) define transitions or dependencies. Mermaid flowcharts support directional variants:
      - \`LR\` = left-to-right,
      - \`RL\` = right-to-left,
      - \`TB\` = top-to-bottom,
      - \`BT\` = bottom-to-top.
      Arrows can have different heads or styles (e.g., solid, dotted, bidirectional), and subgraphs can group related nodes. Use when illustrating algorithms, workflows, or causal structures.
    - \`"sequenceDiagram"\` — **Sequence diagrams** describe message flow between participants over time. Each participant (actor or component) is represented by a vertical lifeline, and horizontal arrows show synchronous or asynchronous communication, activations, and returns. Useful for modeling protocols, request–response patterns, or multi-step interactions between systems or roles.
    - \`"classDiagram"\` — **Class diagrams** represent object-oriented structures. Each class has attributes and methods, and relationships (e.g., inheritance, composition, association) are depicted as labeled links. Ideal for showing type hierarchies, data models, or software architecture.
    - \`"stateDiagram-v2"\` — **State diagrams** depict finite-state machines, showing how a system transitions between discrete states in response to events. Each node is a state, and edges represent transitions. Useful for modeling protocols, UI flows, or lifecycle logic.
    - \`"erDiagram"\` — **Entity–relationship diagrams** model relational data structures. Entities represent data objects, and relationships express cardinalities and connections (one-to-one, one-to-many, many-to-many). Use to visualize schemas, domain models, or database designs.
    - \`"pie"\` — **Pie charts** display numerical proportions in a circular form. Each slice’s arc length and area are proportional to its value. Titles and labels describe categories. Use when summarizing categorical data or proportions in a transcript’s content.
- The final output must be **valid JSON** matching this structure and must not include any extra keys, commentary, or non-JSON text outside the array.

Adjust your response according to the current lecture preferences:

- Lecture length is set to "${effective_preferences.lecture_length}".  
  Generate approximately ${
    effective_preferences.lecture_length === "short"
      ? "3–5"
      : effective_preferences.lecture_length === "medium"
        ? "8–10"
        : "12–15"
  } slides in total.

- The lecture tone is "${effective_preferences.tone}".  
  ${
    effective_preferences.tone === "direct"
      ? "Write in a concise, factual, and instructional manner, minimizing filler."
      : effective_preferences.tone === "warm"
        ? "Use a friendly, supportive, and encouraging tone, as if guiding a student patiently."
        : "Add light humor or playful analogies where appropriate, keeping the content accurate and engaging."
  }
`;

  return llm.sendMessage(PROMPT, ZGenerateTranscriptResponse);
}
