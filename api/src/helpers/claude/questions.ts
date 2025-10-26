import { lectureDoc } from "../../lib/firebase_admin";
import { LLM } from "./llm";
import { UserQuestionRequest, ZUserAnalyzeQuery } from "schema/zod_types";
import { z } from "zod";
import { ZGenerateTranscriptResponse } from "./transcript";
import { ASSET_CACHE } from "../../lib/file_cache";

export async function generate_user_question_response(
  llm: LLM,
  req: UserQuestionRequest
) {
  const doc = await lectureDoc(req.lecture_id).get();
  const ld = doc.data();
  const slidesSoFar = ld?.slides?.slice(0, req.current_slide + 1)!;

  const REGEN_FIRST_QUERY = `
You are an expert lecturer who has been delivering a structured, slide-by-slide lecture on the topic: ${ld}.

A student has paused your lecture and asked the following question:
---
${req.question}
---

For context, here is the transcript of the slides you have covered so far (each slide separated by triple dashes):
---
${slidesSoFar.map((s) => s.transcript).join("\n\n---\n\n")}
---

Your task is to decide whether this question:
1. Can be answered briefly and clearly within the inline chat, using only a paragraph or two, **without significantly shifting the lecture’s direction**, or
2. Requires **regenerating the remaining slides**, because the question meaningfully changes the scope, direction, or conceptual focus of the lecture, or demands a level of depth that would be better addressed by restructuring future slides.

Make your decision using both topical relevance (does the question remain within the scope of previous slides?) and conceptual complexity (is it answerable concisely or does it need a deeper exploration?).

### Output Requirements
- You must output **only a single JSON object**, with no additional text, explanation, or commentary before or after.
- Do not restate or include any part of the transcript or the question verbatim in the response beyond what’s required by the schema.
- Do not include code fences, Markdown, or natural-language introductions.
- Do not speculate or invent details outside the provided information.

### Response Schema
If the question is simple and can be answered inline:
{
  "answer_category": "simple",
  "response": string  // one concise, self-contained paragraph that directly answers the user's question, using information consistent with the lecture so far.
}

If the question requires regenerating slides:
{
  "answer_category": "regenerate_slides",
  "response": string,       // a short, natural-sounding reassurance to the user that you will regenerate the lecture to address their question.
  "instructions": string    // a compact, high-level set of generation instructions describing *why* the regeneration is needed, *what the user asked*, and *how the new lecture should adapt its direction*. Do NOT include transcripts or slides here.
}
`;

  return llm.sendMessage(REGEN_FIRST_QUERY, ZUserAnalyzeQuery);
}
