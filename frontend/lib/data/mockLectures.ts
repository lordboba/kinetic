import { lectureAssetSchema } from "@/lib/schemas/lecture";
import type { LectureAsset } from "@/lib/schemas/lecture";

const rawLectures = [
  {
    id: "adaptive-neural-networks",
    title: "Adaptive Neural Networks",
    tagline: "Understand how neural nets reshape themselves for each learner.",
    tags: ["AI", "Neuroscience", "Accessibility"],
    durationMinutes: 42,
    summary:
      "Explore the fundamentals of adaptive neural networks, from gradient descent intuition to multimodal inference for personalization.",
    instructorNote:
      "Ideal for learners who want a balanced mix of conceptual storytelling, visual diagrams, and hands-on coding exercises.",
    coverImage: "/images/lecture-neural-networks.png",
    formats: ["Visual summary", "Audio narration", "Code-first demo"],
    progress: [
      { key: "transcript", label: "Transcript", status: "complete" },
      { key: "slides", label: "Slide deck", status: "complete" },
      { key: "diagrams", label: "Diagram set", status: "in-progress" },
      { key: "voiceover", label: "Voiceover", status: "pending", etaMinutes: 8 },
    ],
    practicePrompts: [
      "Simulate a gradient descent step and narrate each adjustment.",
      "Sketch a diagram showing how modality preferences feed adaptation.",
    ],
  },
  {
    id: "applied-quantum-computing",
    title: "Applied Quantum Computing",
    tagline:
      "Translate the math of qubits into visual stories and code walkthroughs.",
    tags: ["Physics", "Engineering", "Visualization"],
    durationMinutes: 36,
    summary:
      "Break down core quantum computing concepts using visual analogies, interactive code labs, and Socratic prompts to reinforce intuition.",
    instructorNote:
      "Pairs especially well with learners who benefit from audiovisual reinforcement and quick practice loops.",
    coverImage: "/images/lecture-quantum.png",
    formats: ["Audio-first", "Whiteboard walkthrough", "Practice prompts"],
    progress: [
      { key: "transcript", label: "Transcript", status: "complete" },
      { key: "slides", label: "Slide deck", status: "in-progress" },
      { key: "diagrams", label: "Diagram set", status: "pending", etaMinutes: 12 },
      { key: "voiceover", label: "Voiceover", status: "complete" },
    ],
    practicePrompts: [
      "Explain superposition using a personal learning metaphor.",
      "Build a Bloch sphere diagram in Mermaid to show state transitions.",
    ],
  },
  {
    id: "ethics-of-ai-teaching",
    title: "Ethics of AI Teaching Agents",
    tagline: "Design equitable AI instructors with transparent scaffolding.",
    tags: ["Ethics", "Education", "Policy"],
    durationMinutes: 28,
    summary:
      "Survey the ethical landscape for AI teachers, covering transparency, bias mitigation, accessibility, and regulatory considerations.",
    instructorNote:
      "Use this lecture to spark discussion with reflective prompts and TA-suggested resources for continued exploration.",
    coverImage: "/images/lecture-ethics.png",
    formats: ["Discussion guide", "Interactive Q&A", "Audio summary"],
    progress: [
      { key: "transcript", label: "Transcript", status: "complete" },
      { key: "slides", label: "Slide deck", status: "complete" },
      { key: "diagrams", label: "Diagram set", status: "complete" },
      { key: "voiceover", label: "Voiceover", status: "complete" },
    ],
    practicePrompts: [
      "Draft guidelines for interrupting the lecture to ask sensitive questions.",
      "List accessibility accommodations the TA agent should proactively offer.",
    ],
  },
];

export const mockLectures: LectureAsset[] = rawLectures.map((lecture) =>
  lectureAssetSchema.parse(lecture),
);

export function getLectureById(id: string): LectureAsset | undefined {
  return mockLectures.find((lecture) => lecture.id === id);
}
