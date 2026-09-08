import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCandidate } from "../src/events/score.mjs";

test("high-impact keywords raise the score", () => {
  const low = scoreCandidate({ title: "Some minor update", summary: "" });
  const high = scoreCandidate({ title: "SEC approves new Bitcoin ETF", summary: "" });
  assert.ok(high.importance > low.importance);
});

test("large market moves raise the score", () => {
  const small = scoreCandidate({ kind: "market_move", title: "BTC up 1%", meta: { change24h: 1 } });
  const large = scoreCandidate({ kind: "market_move", title: "BTC up 15%", meta: { change24h: 15 } });
  assert.ok(large.importance > small.importance);
});

test("score is clamped between 0 and 10", () => {
  const extreme = scoreCandidate({
    title: "SEC ETF hack exploit fed interest rate regulation ban lawsuit bankruptcy",
    summary: "listing delisting partnership acquisition outage liquidation whale",
    kind: "market_move",
    meta: { change24h: 90 },
  });
  assert.ok(extreme.importance <= 10);
});
