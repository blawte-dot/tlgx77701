import { RSS_FEEDS } from "../sources/rss.mjs";

const TRUSTED_SOURCES = new Set([...RSS_FEEDS.map((f) => f.name), "CoinGecko"]);

// Language that signals an unverified rumor rather than a confirmed fact.
const RUMOR_SIGNALS = ["rumor", "reportedly", "unconfirmed", "alleged", "sources say", "speculat"];

/**
 * Runs a candidate through basic verification gates. Never publishes
 * unverified rumors as facts — flags them instead so the content
 * engine can phrase them explicitly as unconfirmed.
 */
export function verifyCandidate(candidate) {
  const checks = {
    sourceTrusted: TRUSTED_SOURCES.has(candidate.source),
    hasContent: Boolean(candidate.title && candidate.title.length > 8),
    isFresh: candidate.publishedAt
      ? Date.now() - new Date(candidate.publishedAt).getTime() < 48 * 3_600_000
      : true,
    isRumor: RUMOR_SIGNALS.some((sig) =>
      `${candidate.title} ${candidate.summary}`.toLowerCase().includes(sig)
    ),
  };

  const passed = checks.sourceTrusted && checks.hasContent && checks.isFresh;

  return {
    ...candidate,
    verification: checks,
    verified: passed,
  };
}

export function verifyAll(candidates) {
  return candidates.map(verifyCandidate);
}
