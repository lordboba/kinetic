import { LLM } from './llm.js';

/**
 * Generate Mermaid diagram code from slide transcript and diagram description
 * @param llm - LLM instance to use for generation
 * @param transcript - The slide transcript text
 * @param diagramDescription - Description of diagram type and what to visualize
 * @returns Mermaid code as string
 */
export async function generateMermaidDiagram(
  llm: LLM,
  transcript: string,
  diagramDescription: string
): Promise<string> {
  const prompt = `Generate Mermaid diagram code based on this content.

SLIDE TRANSCRIPT:
${transcript}

DIAGRAM DESCRIPTION (includes type and what to show):
${diagramDescription}

Instructions:
- Follow the diagram type specified in the description
- Keep it simple (max 6-8 nodes)
- Use concise labels (2-4 words per node)
- Return ONLY the Mermaid code (no markdown fences, no explanations)
- Start directly with the diagram type declaration

Mermaid code:`;

  const mermaidCode = await llm.sendMessage(prompt);

  // clean up the response (remove any markdown fences if present)
  return mermaidCode.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim();
}
