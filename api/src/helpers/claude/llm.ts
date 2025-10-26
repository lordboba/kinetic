import Anthropic from "@anthropic-ai/sdk";
import { Tool } from "@anthropic-ai/sdk/resources";
import * as z from "zod";

type BatchInput = {
  id: string; // caller-provided unique id
  prompt: string; // the actual prompt
};

export class LLM {
  static sendMessage(arg0: string) {
    throw new Error("Method not implemented.");
  }
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, model = "claude-sonnet-4-5", maxTokens = 4096) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        "Anthropic API key is missing. Set ANTHROPIC_API_KEY in the environment."
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  /**
   * Sends a single user message to Claude and returns the plain text response.
   */
  async sendMessage<T extends z.ZodType>(
    prompt: string,
    schema: T
  ): Promise<z.infer<T>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "json",
          description: "Respond with a JSON object",
          input_schema: z.toJSONSchema(schema) as Tool.InputSchema,
        },
      ],
      tool_choice: { name: "json", type: "tool" as const },
    });

    const contentBlock = response.content.find((c) => c.type === "tool_use");

    if (!contentBlock) {
      throw new Error("LLM response did not contain a tool_use block");
    }

    const result = schema.safeParse(contentBlock.input);

    if (!result.success) {
      throw new Error(
        "LLM response failed schema validation: " +
        JSON.stringify(z.treeifyError(result.error), null, 2)
      );
    }

    return result.data as z.infer<T>;
  }

  /**
   * Sends multiple prompts as a batch and returns an array of parsed responses.
   * All responses will conform to the same schema.
   */

  async sendBatch<T extends z.ZodType>(
    items: BatchInput[],
    schema: T
  ): Promise<Array<{ id: string; data: z.infer<T> }>> {
    // 1. Build requests.
    //
    // For each item, we create a per-item schema that requires the model
    // to return the same id we provided for that item.
    //
    // Why per-item schema?
    // Because we can force: id === that item's id, using z.literal(...)
    //
    const requests = items.map(({ id, prompt }) => {
      // This is the per-request schema we tell the model to satisfy.
      // It's: { id: "<that id>", ...schema }
      const schemaWithId = z
        .object({
          id: z.literal(id),
        })
        .and(schema);

      return {
        custom_id: id, // this flows back from the batch results API
        params: {
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [
            {
              role: "user" as const,
              content:
                prompt +
                `\n\nYou MUST call the tool "json". In that tool call, return a JSON object that matches the required schema. The field "id" MUST be exactly "${id}".`,
            },
          ],
          tools: [
            {
              name: "json",
              description:
                "Return a JSON object with the requested fields. You MUST include the required 'id' field.",
              input_schema: z.toJSONSchema(schemaWithId) as Tool.InputSchema,
            },
          ],
          tool_choice: { name: "json", type: "tool" as const },
        },
      };
    });

    // 2. Create the batch.
    const batch = await this.client.messages.batches.create({
      requests,
    });

    // 3. Poll until not in_progress/canceling.
    let currentBatch = batch;
    while (
      currentBatch.processing_status === "in_progress" ||
      currentBatch.processing_status === "canceling"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentBatch = await this.client.messages.batches.retrieve(batch.id);
    }

    // 4. We'll assemble results by custom_id.
    // We'll return them in the same order the caller passed in.
    // If any item fails schema validation, we just skip it (you can change that).
    //
    // Keep the id in the stored value
    const parsedById = new Map<string, { id: string } & z.infer<T>>();

    for await (const result of await this.client.messages.batches.results(
      batch.id
    )) {
      const reqId = result.custom_id; // <-- provided by us earlier

      if (result.result.type !== "succeeded" || !reqId) {
        continue;
      }

      // Find the 'tool_use' block
      const contentBlock = result.result.message.content.find(
        (c) => c.type === "tool_use"
      );

      // Reconstruct the same schemaWithId we enforced for THIS id
      // so we can verify both structure and correct id.
      const originalItem = items.find((it) => it.id === reqId);
      if (!originalItem) {
        continue;
      }

      const schemaWithIdForThisItem = z
        .object({
          id: z.literal(reqId),
        })
        .and(schema);

      // Validate model output (tool input)
      const parsed = schemaWithIdForThisItem.safeParse(contentBlock?.input);

      if (parsed.success) {
        parsedById.set(reqId, parsed.data); // no destructuring
      }
    }

    // 5. Build final array in the exact same order as input.
    const results = items.map(({ id }) => {
      const data = parsedById.get(id);
      if (data === undefined) return undefined;
      return { id, data };
    });

    // Just filter to remove `undefined`
    const filtered = results.filter(Boolean) as Array<{
      id: string;
      data: z.infer<T>;
    }>;

    return filtered;
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
