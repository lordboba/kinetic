import Anthropic from "@anthropic-ai/sdk";
import { Tool } from "@anthropic-ai/sdk/resources";
import * as z from "zod";

export class LLM {
  static sendMessage(arg0: string) {
    throw new Error("Method not implemented.");
  }
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, model = "claude-sonnet-4-5", maxTokens = 1024) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  /**
   * Sends a single user message to Claude and returns the plain text response.
   */
  async sendMessage<T extends z.ZodType>(
    prompt: string,
    schema?: T
  ): Promise<any> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: "user", content: prompt }],
      ...(schema
        ? {
            tools: [
              {
                name: "json",
                description: "Respond with a JSON object",
                input_schema: z.toJSONSchema(schema) as Tool.InputSchema,
              },
            ],
            tool_choice: { name: "json", type: "tool" as const },
          }
        : {}),
    });

    if (schema) {
      const contentBlock = response.content.find((c) => c.type == "tool_use");
      const result = schema.safeParse(contentBlock?.input);
      return result.data as z.infer<T>;
    } else {
      const contentBlock = response.content.find((c) => c.type === "text");
      return contentBlock ? contentBlock.text : "";
    }
  }
}

export class StringAccumulator {
  private acc: string[];
  constructor(init: string) {
    this.acc = [init];
  }
  add(str: string) {
    this.acc.push(str);
  }
  newline() {
    this.acc.push("\n");
  }
  collect(): string {
    return this.acc.join("\n");
  }
}
