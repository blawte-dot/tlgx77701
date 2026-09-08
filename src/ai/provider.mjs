import { config } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import fetch from "node-fetch";

// Google AI Studio (Gemini) free tier — no billing account, no credit card.
// Flash is the model kept in the free tier as of 2026.
const MODEL = "gemini-3-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Thin abstraction over the AI provider so the provider itself can be
 * swapped later without touching the content-generation logic.
 * Enforces the daily AI-call budget guard before every call.
 */
export async function generateText({ system, prompt, maxTokens = 500 }) {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!costControl.canCallAi()) {
    throw new Error("Daily AI call budget reached");
  }

  const url = `${API_BASE}/${MODEL}:generateContent?key=${config.geminiApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  costControl.recordAiCall();

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text.trim();
}

