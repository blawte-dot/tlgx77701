// Keyword weights used as an importance signal. This is intentionally
// simple and transparent (not a black-box model) so the reasoning
// behind a publish decision can always be inspected/adjusted.
const HIGH_IMPACT_TERMS = [
  "sec", "etf", "hack", "exploit", "halving", "fed", "interest rate",
  "regulation", "ban", "lawsuit", "bankruptcy", "listing", "delisting",
  "partnership", "acquisition", "outage", "liquidation", "whale",
];
const MEDIUM_IMPACT_TERMS = [
  "upgrade", "launch", "partnership", "airdrop", "mainnet", "testnet",
  "funding", "investment", "report", "analysis",
];

function scoreText(text) {
  const t = (text || "").toLowerCase();
  let score = 0;
  for (const term of HIGH_IMPACT_TERMS) if (t.includes(term)) score += 3;
  for (const term of MEDIUM_IMPACT_TERMS) if (t.includes(term)) score += 1;
  return score;
}

/**
 * Scores a candidate event 0-10 (importance) based on source reliability,
 * keyword signals, recency, and (for market moves) magnitude.
 */
export function scoreCandidate(candidate) {
  let score = scoreText(candidate.title) + scoreText(candidate.summary);

  if (candidate.kind === "market_move") {
    const change = Math.abs(candidate.meta?.change24h ?? 0);
    score += Math.min(6, Math.floor(change / 2)); // bigger move = more important
  }

  // Recency boost: events collected within the last 2 hours score higher.
  if (candidate.publishedAt) {
    const ageMs = Date.now() - new Date(candidate.publishedAt).getTime();
    const ageHours = ageMs / 3_600_000;
    if (ageHours <= 1) score += 2;
    else if (ageHours <= 2) score += 1;
    else if (ageHours > 24) score -= 2; // stale news is rarely worth posting
  }

  // Cross-source corroboration: multiple outlets covering the same story
  // right now is a genuine trending signal.
  const corroboration = candidate.corroboratingSources || 1;
  if (corroboration >= 3) score += 3;
  else if (corroboration === 2) score += 1.5;

  return {
    ...candidate,
    importance: Math.max(0, Math.min(10, score)),
  };
}

export function scoreAll(candidates) {
  return candidates.map(scoreCandidate).sort((a, b) => b.importance - a.importance);
}

/** Minimum importance required to be a publish candidate at all. */
export const MIN_PUBLISH_SCORE = 2;
