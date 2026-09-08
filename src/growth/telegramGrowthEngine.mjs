import { store } from "../state/store.mjs";
import { config } from "../config.mjs";

// CTA is only warranted for posts that genuinely have more depth waiting
// on Telegram — never attached to every single X post.
const CTA_ELIGIBLE_KINDS = new Set(["market_move"]);
const CTA_ELIGIBLE_IMPORTANCE = 6;

const CTA_TEMPLATES = {
  breaking: "More context and live updates → Telegram",
  deep_analysis: "Full breakdown on Telegram.",
  alert: "Tracking this closely. Follow-up alerts on Telegram.",
  daily_recap: "Full daily recap on Telegram.",
  exclusive_data: "Deeper data and charts on Telegram.",
  follow_up: "This story is still developing — updates on Telegram.",
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Decides whether an X post deserves a Telegram CTA, and if so, which
 * category/text to use. Deliberately conservative — most posts get none.
 */
export function decideCta({ event, xFormat }) {
  const eligible =
    event.importance >= CTA_ELIGIBLE_IMPORTANCE ||
    CTA_ELIGIBLE_KINDS.has(event.kind) ||
    xFormat === "thread";

  if (!eligible) return { include: false };

  // Even when eligible, only include it part of the time — avoid CTA fatigue.
  if (Math.random() > 0.5) return { include: false };

  const category = event.importance >= 8 ? "deep_analysis" : pick(["alert", "follow_up", "breaking"]);
  return {
    include: true,
    category,
    text: CTA_TEMPLATES[category] || CTA_TEMPLATES.follow_up,
  };
}

/**
 * Appends the CTA line to an X post if one was decided, and records
 * the campaign for later performance tracking.
 */
export function applyCta({ xPostText, xPostId, event, cta }) {
  if (!cta.include) return xPostText;

  const withCta = `${xPostText}\n\n${cta.text}`;

  store.append("ctaCampaigns", {
    xPostId: xPostId || null,
    eventFingerprint: event.fingerprint,
    ctaCategory: cta.category,
    ctaText: cta.text,
    telegramLink: `https://t.me/${config.telegram.channelUsername || ""}`.replace(/\/$/, ""),
    timestamp: new Date().toISOString(),
    subscribersAfter: null, // filled in later by the analytics job, when technically available
  });

  return withCta;
}
