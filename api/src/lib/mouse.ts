import { LLM } from "../helpers/claude/llm";

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

export const llm = new LLM(anthropicKey);
export const haikuLlm = new LLM(anthropicKey, "claude-haiku-4-5");
