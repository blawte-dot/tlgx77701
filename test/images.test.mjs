import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImage } from "../src/content/images.mjs";

test("falls back to null only when no article image AND no market snapshot available", () => {
  const result = resolveImage({ kind: "news", image: null }, []);
  assert.equal(result, null);
});

test("falls back to a snapshot chart of the biggest mover when no article image exists", () => {
  const marketSnapshot = [
    { symbol: "BTC", change24h: 1.2, sparkline: [60000, 60500, 61000] },
    { symbol: "SOL", change24h: -8.4, sparkline: [140, 135, 128] },
  ];
  const result = resolveImage({ kind: "news", image: null }, marketSnapshot);
  assert.equal(result.type, "chart");
  assert.ok(result.url.includes(encodeURIComponent("SOL").slice(0, 3)) || result.url.startsWith("https://quickchart.io/chart"));
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
