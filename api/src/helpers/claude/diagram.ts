import {config as loadEnv} from 'dotenv';
import path from 'node:path';
import { URL } from 'node:url';
import { z } from 'zod';

import { LLM } from "./llm.js";

export async function generate_diagram(
  llm: LLM, 
  slide_content: {
    title: string;
    transcript: string;
    bullet_points?: string;
  }
) {
  const prompt = `You are creating a Mermaid diagram for an educational lecture slide.

    Slide Title: "${slide_content.title}"

    Slide Content:
    ${slide_content.transcript}

    ${slide_content.bullet_points ? `Key Points:\n${slide_content.bullet_points}` : ''}

    Generate a clear, pedagogically-effective Mermaid diagram that:
    1. Visualizes the KEY concept or process from this slide
    2. Is simple enough to understand at a glance (max 6-8 nodes)
    3. Uses appropriate diagram type:
    - flowchart: for processes, steps, decision trees
    - graph: for relationships, hierarchies, concept maps
    - sequenceDiagram: for interactions, timelines
    - classDiagram: for categorizations, taxonomies
    4. Labels all nodes clearly with concise text (2-4 words each)
    5. Uses meaningful connections/relationships

    Return ONLY the Mermaid code (no markdown fences, no explanations).
    Start directly with the diagram type (e.g., "flowchart TD" or "graph LR").

    Example output format:
    flowchart TD
        A[Start] --> B[Process]
        B --> C[End]

    Mermaid diagram:`;

  const diagram = await llm.sendMessage(prompt);

  return diagram;
}

// BETTER TEST EXAMPLE
const testSlide = {
  title: "Photosynthesis Process",
  transcript: `Photosynthesis is how plants convert light energy into chemical energy. 
  It happens in two main stages: the light-dependent reactions in the thylakoid membranes, 
  where water is split and ATP is produced, and the light-independent reactions (Calvin cycle) 
  in the stroma, where CO2 is fixed into glucose.`,
  bullet_points: `• Light reactions: H2O → O2 + ATP
- Calvin cycle: CO2 → Glucose
- Location: Chloroplasts`
};

const llm = new LLM(process.env.ANTHROPIC_API_KEY!);

console.log(await generate_diagram(llm, testSlide));