import { config } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import { store } from "../state/store.mjs";
import fetch from "node-fetch";

// Google frequently renames/retires Gemini model IDs. Rather than hardcode
// one name that will eventually 404, we try candidates in order (newest
// first) and cache whichever one actually works, so a future deprecation
// self-heals on the next run instead of silently failing forever.
const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getCachedModel() {
  const cache = store.getAll("model-cache", null);
  return cache?.workingModel || null;
}

function setCachedModel(model) {
  store.set("model-cache", { workingModel: model, cachedAt: new Date().toISOString() });
}

async function callModel(model, { system, prompt, maxTokens }) {
  const url = `${API_BASE}/${model}:generateContent?key=${config.geminiApiKey}`;
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
    const err = new Error(`Gemini API error (${res.status}) on ${model}: ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text.trim();
}

/**
 * Thin abstraction over the AI provider so the provider itself can be
 * swapped later without touching the content-generation logic.
 * Enforces the daily AI-call budget guard before every call, and
 * self-heals against Gemini model-ID deprecations.
 */
export async function generateText({ system, prompt, maxTokens = 500 }) {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!costControl.canCallAi()) {
    throw new Error("Daily AI call budget reached");
  }

  const cached = getCachedModel();
  const tryOrder = cached ? [cached, ...CANDIDATE_MODELS.filter((m) => m !== cached)] : CANDIDATE_MODELS;

  let lastErr = null;
  for (const model of tryOrder) {
    try {
      const text = await callModel(model, { system, prompt, maxTokens });
      if (model !== cached) setCachedModel(model);
      costControl.recordAiCall();
      return text;
    } catch (err) {
      lastErr = err;
      // Only fall through to the next candidate on a "model not found /
      // not supported" style error. Any other error (bad key, rate limit,
      // content policy) should surface immediately, not mask itself as
      // "try the next model".
      if (err.status !== 404) throw err;
    }
  }
  throw lastErr || new Error("No working Gemini model found");
}


