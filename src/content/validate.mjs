// Patterns that mean the model broke character and produced a
// conversational/meta response instead of an actual post — this is the
// exact failure mode of publishing something like "Could you please
// provide more context?" as if it were real content. Any match is an
// automatic reject, no exceptions.
const AI_META_PATTERNS = [
  /^(sure|okay|ok|certainly)[,!]\s/i,
  /please provide/i,
  /could you (please )?(clarify|specify|provide)/i,
  /as an ai/i,
  /i (cannot|can't|am unable to)/i,
  /it seems (like )?(your|the) (message|request|text) was/i,
  /(the text|the message) you('d| would) like me to/i,
  /i('m| am) sorry,? but/i,
  /\bhere('s| is) (a|the|your) (rewrite|revised|post)/i,
];

function detectAiMetaLeak(text) {
  return AI_META_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Runs every quality gate the spec requires before publishing.
 * Returns { pass: boolean, reasons: string[] } — if pass is false,
 * the pipeline must NOT publish this post.
 */
export function validatePost({ platform, text, event }) {
  const reasons = [];

  if (!text || text.trim().length < 5) {
    reasons.push("empty_or_too_short");
  }

  if (detectAiMetaLeak(text)) {
    reasons.push("ai_meta_response_leak");
  }

  if (platform === "x" && text.length > 280) {
    reasons.push("exceeds_x_character_limit");
  }

  if (platform === "telegram" && text.length > 4096) {
    reasons.push("exceeds_telegram_character_limit");
  }

  // Factuality/source check: an unverified rumor must be framed as such.
  if (event?.verification?.isRumor) {
    const framed = /unconfirmed|reportedly|alleged|rumou?r|unverified/i.test(text);
    if (!framed) reasons.push("rumor_not_framed_as_unconfirmed");
  }

  // Safety/policy check: no guaranteed-profit or advice language.
  if (/guaranteed?\s+(profit|return)|financial advice/i.test(text)) {
    reasons.push("prohibited_language");
  }

  // Link check: if the event has a link but the post references "link" text without one.
  // (kept intentionally light — link inclusion is a style choice, not mandatory)

  return { pass: reasons.length === 0, reasons };
}
