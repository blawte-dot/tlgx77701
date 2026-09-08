import { test } from "node:test";
import assert from "node:assert/strict";
import { decideCta, applyCta } from "../src/growth/telegramGrowthEngine.mjs";

test("low-importance non-market events never get a CTA", () => {
  const event = { importance: 1, kind: "news", fingerprint: "abc" };
  const cta = decideCta({ event, xFormat: "short_post" });
  assert.equal(cta.include, false);
});

test("applyCta returns text unchanged when CTA not included", () => {
  const result = applyCta({ xPostText: "Hello world", xPostId: null, event: {}, cta: { include: false } });
  assert.equal(result, "Hello world");
});

test("applyCta appends CTA text when included", () => {
  const event = { fingerprint: "abc", importance: 9 };
  const cta = { include: true, category: "deep_analysis", text: "Full breakdown on Telegram." };
  const result = applyCta({ xPostText: "Hello world", xPostId: "123", event, cta });
  assert.ok(result.includes("Full breakdown on Telegram."));
  assert.ok(result.startsWith("Hello world"));
});
