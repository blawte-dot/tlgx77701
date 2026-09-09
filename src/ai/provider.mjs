import { config } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import { store } from "../state/store.mjs";
import fetch from "node-fetch";

// Google frequently renames/retires Gemini model IDs (e.g. the entire
// 2.0 and 1.5 generations were shut down in 2026). Instead of hardcoding
// a name that will eventually 404, we ask the API itself which models
// currently support generateContent, rank them, and cache the pick —
// so a future deprecation self-heals on the next call instead of
// silently failing forever.
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Preference order once we have the live list: cheap/generous-quota
// "flash-lite" first (best fit for a high-frequency low-cost pipeline),
// then plain "flash", avoiding "-latest" aliases (reported unstable on
// the free tier) and anything preview/experimental/pro/vision/embedding.
function rankModel(name) {
  const n = name.toLowerCase();
  if (n.includes("latest") || n.includes("preview") || n.includes("exp")) return 100;
  if (n.includes("pro") || n.includes("vision") || n.includes("embed") || n.includes("image")) return 90;
  if (n.includes("flash-lite")) return 0;
  if (n.includes("flash")) return 1;
  return 50;
}

async function discoverModels() {
  const res = await fetch(`${API_BASE}?key=${config.geminiApiKey}`);
  if (!res.ok) throw new Error(`Gemini ListModels error (${res.status})`);
  const data = await res.json();
  const usable = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  usable.sort((a, b) => rankModel(a) - rankModel(b));
  return usable;
}

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
  let tryOrder = cached ? [cached] : [];

  let lastErr = null;
  for (const model of tryOrder) {
    try {
      const text = await callModel(model, { system, prompt, maxTokens });
      costControl.recordAiCall();
      return text;
    } catch (err) {
      lastErr = err;
      if (err.status !== 404 && err.status !== 503) throw err;
      // cached model no longer works — fall through to live discovery below
    }
  }

  // No working cached model (or none cached yet): ask the API what's
  // actually available right now, and try those candidates in ranked order.
  const discovered = await discoverModels();
  for (const model of discovered) {
    if (model === cached) continue; // already tried and failed above
    try {
      const text = await callModel(model, { system, prompt, maxTokens });
      setCachedModel(model);
      costControl.recordAiCall();
      return text;
    } catch (err) {
      lastErr = err;
      if (err.status !== 404 && err.status !== 503) throw err;
    }
  }

  throw lastErr || new Error("No working Gemini model found");
}


