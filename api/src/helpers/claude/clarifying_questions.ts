import * as z from "zod";

import { CreateLectureQuestion, LecturePreferences } from "schema";
import { LecturePreferencesSchema } from "../../schemas/create-lecture.js";
import { LLM } from "./llm";

export const ZGenerateClarifyingQuestionsRequest = z.object({
  topic: z.string().min(1),
  user_preferences: LecturePreferencesSchema,
  custom_preferences: LecturePreferencesSchema.optional(),
});

export type GenerateClarifyingQuestionsRequest = z.infer<
  typeof ZGenerateClarifyingQuestionsRequest
>;

// zod type for the LLM (makes it return it in a specific format)
// Note: Anthropic tool calling requires the root schema to be an object, not an array
// So we wrap the questions array in an object
export const ZGenerateClarifyingQuestionsResponse = z.object({
  questions: z.array(
    z.discriminatedUnion("question_type", [
      z.object({
        question_type: z.literal("radio"),
        question: z.string(),
        options: z.array(
          z.object({
            text: z.string(),
          })
        ),
      }),
      z.object({
        question_type: z.literal("checkbox"),
        question: z.string(),
        options: z.array(
          z.object({
            text: z.string(),
          })
        ),
      }),
      z.object({
        question_type: z.literal("text_input"),
        question: z.string(),
      }),
    ])
  ),
});

export async function generate_clarifying_questions(
  llm: LLM,
  req: GenerateClarifyingQuestionsRequest
): Promise<CreateLectureQuestion[]> {
  const parsedReq = ZGenerateClarifyingQuestionsRequest.parse(req);

  const { topic, user_preferences, custom_preferences } = parsedReq;

  const effective_preferences = {
    ...user_preferences,
    ...custom_preferences,
  };

  const PROMPT = `
You are an expert lecturer being asked to prepare a lecture on the following topic: ${topic}.

Before creating the lecture, you need to ask the user 3-4 clarifying questions to better understand:
- Their current knowledge level on this topic
- Specific aspects or subtopics they want to focus on
- Their learning goals and what they hope to get from the lecture

Return a JSON object with a "questions" field containing an array of clarifying questions:
{
  "questions": [ /* array of question objects */ ]
}

Each question object in the array must have the following structure:

For radio (single-choice) or checkbox (multiple-choice) questions:
{
  "question_type": "radio" OR "checkbox",
  "question": string, // The question text to ask the user
  "options": [
    {
      "text": string, // The option text
    }
  ]
}

For open-ended text questions:
{
  "question_type": "text_input",
  "question": string // The question text to ask the user
}

**Guidelines:**
- Question type 1: Use "radio" for single-choice questions (e.g., "What is your current experience level with ${topic}?")
- Question type 2: Use "checkbox" for multiple-choice questions where users can select multiple options (e.g., "Which aspects interest you most?")
- Question type 3: Use "text_input" for open-ended questions (e.g., "What specific applications or examples would you like covered?")
- Include at least one question of each of the three question types listed above.
- For radio/checkbox questions, provide 3-5 meaningful options
- Make sure each question helps you create a more personalized and effective lecture
- Generate 3-4 questions total
- Each question_id must be unique (e.g., "q1", "q2", "q3")
- Each option_id must be unique within that question (e.g., "q1_opt1", "q1_opt2")

**Tone:** Your questions should match the "${effective_preferences.tone}" tone:
${
  effective_preferences.tone === "direct"
    ? "Write in a concise, factual manner. Ask direct, straightforward questions."
    : effective_preferences.tone === "warm"
      ? "Use a friendly, supportive tone. Make the user feel comfortable and encouraged."
      : "Add light humor or playful language where appropriate while keeping questions clear."
}

**Output:** Return ONLY valid JSON matching the structure above. Do not include any extra keys, commentary, or non-JSON text.
`;

  // is there some way we should store the definitions of different tones so that we're not copy-pasting it each time?
  const result = (await llm.sendMessage(
    PROMPT,
    ZGenerateClarifyingQuestionsResponse
  ))! as { questions: Partial<CreateLectureQuestion>[] };
  result.questions.forEach((q) => {
    q.question_id = crypto.randomUUID();
    if (q.question_type === "checkbox" || q.question_type === "radio") {
      q.options!.forEach((opt) => (opt.option_id = crypto.randomUUID()));
    }
  });
  return result.questions as CreateLectureQuestion[];
}
