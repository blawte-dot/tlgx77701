import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.mjs";
import { costControl } from "../costControl.mjs";

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/**
 * Thin abstraction over the AI provider so the provider itself can be
 * swapped later without touching the content-generation logic.
 * Enforces the daily AI-call budget guard before every call.
 */
export async function generateText({ system, prompt, maxTokens = 500 }) {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!costControl.canCallAi()) {
    throw new Error("Daily AI call budget reached");
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  costControl.recordAiCall();

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}
