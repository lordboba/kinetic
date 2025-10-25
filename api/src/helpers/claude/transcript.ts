import { LLM } from "./llm.js";

export async function generate_transcript(llm: LLM, topic_sentence: string) {
  const transcript = await llm.sendMessage(
    "generate a transcript with this topic sentence" + topic_sentence
  );

  return transcript;
}

// console.log(await generate_transcript(llm, "mouse and mice"));
