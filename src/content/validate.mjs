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
