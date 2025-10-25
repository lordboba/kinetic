import Anthropic from "@anthropic-ai/sdk";

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
  async sendMessage(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract the text part of the response
    const contentBlock = response.content.find((c) => c.type === "text");
    return contentBlock ? contentBlock.text : "";
  }
}
