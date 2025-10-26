import * as dotenv from "dotenv";
import { LLM } from "./llm.js";
import { generate_clarifying_questions } from "./clarifying_questions.js";

// Load environment variables (from project root)
dotenv.config({ path: "../../../../.env" });

async function main() {
  // Check if API key exists
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY not found in .env file");
    process.exit(1);
  }

  console.log("🚀 Testing clarifying questions generation...\n");

  // Create LLM instance
  const llm = new LLM(apiKey);

  // Test with different topics and preferences
  const testCases = [
    {
      topic: "Quantum Mechanics",
      user_preferences: {
        lecture_length: "medium" as const,
        tone: "warm" as const,
        enable_questions: true,
      },
    },
    {
      topic: "Introduction to Machine Learning",
      user_preferences: {
        lecture_length: "short" as const,
        tone: "direct" as const,
        enable_questions: true,
      },
    },
    {
      topic: "The French Revolution",
      user_preferences: {
        lecture_length: "long" as const,
        tone: "funny" as const,
        enable_questions: true,
      },
      custom_preferences: {
        tone: "warm" as const, // This should override the funny tone
      },
    },
  ];

  // Run test for the first case (or change index to test others)
  const testCase = testCases[0];

  console.log(`📚 Topic: ${testCase.topic}`);
  console.log(`🎭 Tone: ${testCase.user_preferences.tone}`);
  console.log(`📏 Length: ${testCase.user_preferences.lecture_length}\n`);
  console.log("Generating questions...\n");

  try {
    const questions = await generate_clarifying_questions(llm, testCase);

    console.log("✅ Success! Generated questions:\n");
    console.log(JSON.stringify(questions, null, 2));

    console.log("\n📊 Summary:");
    console.log(`Total questions: ${questions.length}`);
    questions.forEach((q, idx) => {
      console.log(`  ${idx + 1}. [${q.question_type}] ${q.question}`);
      if ("options" in q && q.options) {
        console.log(`     Options: ${q.options.length}`);
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }
}

main();
