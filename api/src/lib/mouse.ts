import { LLM } from "../helpers/claude/llm";

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

export const llm = new LLM(anthropicKey);
