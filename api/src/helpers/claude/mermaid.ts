import * as z from "zod";
import { LLM } from './llm.js';

// input needed to generate mermaid diagram 
export type GenerateMermaidRequest = {
  diagram_type: string;
  extended_description: string;
};

// output 
export const ZGenerateMermaidResponse = z.object({
  mermaid_code: z.string(),
});

/**
 * Generate Mermaid diagram code from slide transcript and diagram description
 * @param llm - LLM instance to use for generation
 * @param request - Request object containing transcript, diagram type, and description
 * @returns Mermaid code as string
 */
export async function generateMermaidDiagram(
  llm: LLM,
  request: GenerateMermaidRequest
): Promise<string> {
  const { diagram_type, extended_description } = request;

  const PROMPT = `
You are a Mermaid diagram expert. Generate Mermaid diagram code based on the following content:

DIAGRAM TYPE: ${diagram_type}

DIAGRAM DESCRIPTION:
${extended_description}

Instructions:
- Follow the diagram type specified: ${diagram_type}
- Keep it simple and focused (max 6-8 nodes for flowcharts/diagrams)
- Use concise, clear labels (2-4 words per node)
- Return ONLY the raw Mermaid code
- Do NOT wrap in markdown code fences (\`\`\`mermaid)
- Do NOT include any explanations or commentary
- Start directly with the diagram type declaration (e.g., "flowchart LR", "sequenceDiagram", etc.)

Generate the Mermaid code and return it as a JSON object with a single field "mermaid_code" containing the diagram code as a string.
`;

  const response = await llm.sendMessage(PROMPT, ZGenerateMermaidResponse);

  return response.mermaid_code.trim();
}
