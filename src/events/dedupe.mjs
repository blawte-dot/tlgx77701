import crypto from "node:crypto";
import { store } from "../state/store.mjs";

/** Normalizes a title for fuzzy comparison (lowercase, strip punctuation/numbers-noise). */
export function normalizeTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic fingerprint for a candidate event. */
export function fingerprint(candidate) {
  const basis = candidate.link || normalizeTitle(candidate.title);
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 24);
}

/** Cheap token-overlap similarity (0-1) — enough to catch near-duplicate headlines
 *  across sources without pulling in a heavy NLP dependency. */
export function titleSimilarity(a, b) {
  const setA = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 3));
  const setB = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 3));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.max(setA.size, setB.size);
}

/**
 * Filters out candidates that are exact-fingerprint duplicates of
 * already-processed events, or near-duplicates of each other within
 * this same batch (keeps the first occurrence).
 */
export function dedupeCandidates(candidates, { similarityThreshold = 0.6 } = {}) {
  const kept = [];
  for (const c of candidates) {
    const fp = fingerprint(c);
    if (store.hasFingerprint(fp)) continue;

    const isNearDup = kept.some((k) => titleSimilarity(k.title, c.title) >= similarityThreshold);
    if (isNearDup) continue;

    kept.push({ ...c, fingerprint: fp });
  }
  return kept;
}
