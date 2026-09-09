import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImage } from "../src/content/images.mjs";

test("returns null when no article image and not a market move", () => {
  const result = resolveImage({ kind: "news", image: null });
  assert.equal(result, null);
});

test("returns the article image when present", () => {
  const result = resolveImage({ kind: "news", image: "https://example.com/photo.jpg" });
  assert.equal(result.type, "article");
  assert.equal(result.url, "https://example.com/photo.jpg");
});

test("ignores a non-http image value", () => {
  const result = resolveImage({ kind: "news", image: "not-a-url" });
  assert.equal(result, null);
});

test("builds a chart for market moves with sparkline data", () => {
  const result = resolveImage({
    kind: "market_move",
    meta: { symbol: "BTC", change24h: 6.2, sparkline: [60000, 61000, 62000, 63700] },
  });
  assert.equal(result.type, "chart");
  assert.ok(result.url.startsWith("https://quickchart.io/chart"));
});

test("skips chart when sparkline data is missing", () => {
  const result = resolveImage({ kind: "market_move", meta: { symbol: "BTC", change24h: 6.2 } });
  assert.equal(result, null);
});
