import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTitle, titleSimilarity, fingerprint, dedupeCandidates } from "../src/events/dedupe.mjs";

test("normalizeTitle strips punctuation and lowercases", () => {
  assert.equal(normalizeTitle("Bitcoin's Price Surges!!"), "bitcoin s price surges");
});

test("titleSimilarity detects near-duplicate headlines", () => {
  const a = "Bitcoin ETF sees record inflows this week";
  const b = "Bitcoin ETF records massive inflows this week";
  assert.ok(titleSimilarity(a, b) > 0.4);
});

test("titleSimilarity is low for unrelated headlines", () => {
  const a = "Ethereum upgrade goes live on mainnet";
  const b = "Fed signals possible rate cut next quarter";
  assert.ok(titleSimilarity(a, b) < 0.3);
});

test("fingerprint is deterministic for the same link", () => {
  const c1 = { title: "X", link: "https://example.com/a" };
  const c2 = { title: "Y", link: "https://example.com/a" };
  assert.equal(fingerprint(c1), fingerprint(c2));
});

test("dedupeCandidates removes near-duplicates within a batch", () => {
  const candidates = [
    { title: "Bitcoin ETF sees record inflows this week", link: "https://a.com/1" },
    { title: "Bitcoin ETF records massive inflows this week", link: "https://b.com/2" },
    { title: "Ethereum completes network upgrade", link: "https://c.com/3" },
  ];
  const result = dedupeCandidates(candidates);
  assert.equal(result.length, 2);
});
