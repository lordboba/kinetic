import * as z from "zod";

import { CreateLectureQuestion, LecturePreferences } from "schema";
import { LLM } from "./llm";

type GenerateClarifyingQuestionsRequest = {
  topic: string;
  user_preferences: LecturePreferences;
  custom_preferences?: LecturePreferences;
};

// zod type for the LLM (makes it return it in a specific format)
// Note: Anthropic tool calling requires the root schema to be an object, not an array
// So we wrap the questions array in an object
export const ZGenerateClarifyingQuestionsResponse = z.object({
  questions: z.array(
    z.discriminatedUnion("question_type", [
      z.object({
        question_type: z.literal("radio"),
        question: z.string(),
        question_id: z.string(), // UUID
        options: z.array(
          z.object({
            text: z.string(),
            option_id: z.string(), // UUID
          })
        ),
      }),
      z.object({
        question_type: z.literal("checkbox"),
        question: z.string(),
        question_id: z.string(),
        options: z.array(
          z.object({
            text: z.string(),
            option_id: z.string(),
          })
        ),
      }),
      z.object({
        question_type: z.literal("text_input"),
        question: z.string(),
        question_id: z.string(),
      }),
    ])
  ),
});

export async function generate_clarifying_questions(
  llm: LLM,
  req: GenerateClarifyingQuestionsRequest
): Promise<CreateLectureQuestion[]> {
  const {
    topic,
    user_preferences,
    custom_preferences,
  } = req;

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
  "question_id": string, // A unique identifier (UUID format like "q1", "q2", etc.)
  "options": [
    {
      "text": string, // The option text
      "option_id": string // A unique identifier for this option (like "opt1", "opt2", etc.)
    }
  ]
}

For open-ended text questions:
{
  "question_type": "text_input",
  "question": string, // The question text to ask the user
  "question_id": string // A unique identifier (UUID format like "q1", "q2", etc.)
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
  const result = await llm.sendMessage(PROMPT, ZGenerateClarifyingQuestionsResponse);
  return result.questions;
}