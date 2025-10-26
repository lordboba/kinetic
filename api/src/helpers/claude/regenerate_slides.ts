import * as z from "zod";
import { LLM } from "./llm.js";
import { LecturePreferences, LectureSlide } from "schema";

// Schema specifically for regenerated slides (topic not required since we already have it)
const ZRegeneratedSlidesResponse = z.object({
  slides: z.array(
    z.object({
      transcript: z.string(),
      slide: z.object({
        title: z.string(),
        markdown_body: z.string(),
      }),
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
  ),
});

export type RegenerateSlidesRequest = {
  lecture_topic: string;
  previous_slides: LectureSlide[];
  current_slide_index: number;
  user_question: string;
  regeneration_instructions: string;
  user_preferences: LecturePreferences;
};

export async function regenerate_slides_from_question(
  llm: LLM,
  request: RegenerateSlidesRequest
) {
  const {
    lecture_topic,
    previous_slides,
    current_slide_index,
    user_question,
    regeneration_instructions,
    user_preferences,
  } = request;

  // Extract transcripts from previous slides to give context
  const previous_transcripts = previous_slides
    .slice(0, current_slide_index + 1)
    .map((slide, idx) => `## Slide ${idx + 1}: ${slide.title}\n${slide.transcript}`)
    .join("\n\n");

  const PROMPT = `You are an expert lecturer who has been delivering a structured lecture on "${lecture_topic}".

You have delivered the following slides so far:

${previous_transcripts}

---

A student has asked the following question at slide ${current_slide_index + 1}:
"${user_question}"

After analyzing this question, you have determined that the remaining slides need to be regenerated to better address the student's needs.

## Regeneration Instructions:
${regeneration_instructions}

## Your Task:
Generate NEW slides starting from slide ${current_slide_index + 2} onwards that:
1. Build upon the context already covered in the previous ${current_slide_index + 1} slides
2. Address the student's question by adjusting the lecture's direction as described in the regeneration instructions
3. Maintain continuity with what has already been taught
4. Complete the lecture with appropriate depth and closure

Return a JSON object with a top-level \`slides\` array. Each element inside \`slides\` must be an object with the following structure:
{
  "transcript": string, // REQUIRED, plain text transcript for this segment
  "slide": { // REQUIRED
    "title": string, // REQUIRED slide title
    "markdown_body": string // REQUIRED slide Markdown content; 4-6 lines of bullet points or short text.
  },
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
- The nested \`slide\` object and its subfields are **always required**.
- \`question\` is **optional**. Include it only if this part of the transcript naturally invites an in-lecture check-for-understanding. If included, it must contain both \`question_text\` and \`suggested_answer\`.
- Either \`image\` **or** \`diagram\` may be included for each transcript segment — never both. It is also acceptable for a segment to include neither if a visual aid would not add clarity.
- \`image\` is **optional**, but if included it must contain both \`search_term\` and \`extended_description\`.
- \`diagram\` is **optional**, but if included it must contain both \`type\` and \`extended_description\`.
- The final output must be **valid JSON** matching this structure and must not include any extra keys, commentary, or non-JSON text outside the object.
- DO NOT include a \`topic\` field - only return the \`slides\` array.

Adjust your response according to the lecture preferences:

- The lecture was originally ${
    user_preferences.lecture_length === "short"
      ? "3–5"
      : user_preferences.lecture_length === "medium"
        ? "8–10"
        : "12–15"
  } slides in total. Since ${current_slide_index + 1} slides have already been delivered, generate approximately ${
    user_preferences.lecture_length === "short"
      ? Math.max(1, 5 - (current_slide_index + 1))
      : user_preferences.lecture_length === "medium"
        ? Math.max(2, 10 - (current_slide_index + 1))
        : Math.max(3, 15 - (current_slide_index + 1))
  } new slides to complete the lecture (or more if needed to properly address the question).

- The lecture tone is "${user_preferences.tone}".
  ${
    user_preferences.tone === "direct"
      ? "Write in a concise, factual, and instructional manner, minimizing filler."
      : user_preferences.tone === "warm"
        ? "Use a friendly, supportive, and encouraging tone, as if guiding a student patiently."
        : "Add light humor or playful analogies where appropriate, keeping the content accurate and engaging."
  }
`;

  const response = await llm.sendMessage(PROMPT, ZRegeneratedSlidesResponse);

  if (!response || !response.slides || response.slides.length === 0) {
    throw new Error(
      "LLM returned invalid regenerated slides response: " +
      (response ? `missing or empty slides array` : "undefined response")
    );
  }

  return response.slides;
}
