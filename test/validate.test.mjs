import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePost } from "../src/content/validate.mjs";

test("rejects X posts over 280 characters", () => {
  const text = "a".repeat(281);
  const result = validatePost({ platform: "x", text, event: {} });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes("exceeds_x_character_limit"));
});

test("accepts a normal X post", () => {
  const result = validatePost({ platform: "x", text: "Bitcoin just reclaimed $70k.", event: {} });
  assert.equal(result.pass, true);
});

test("rejects unframed rumors", () => {
  const event = { verification: { isRumor: true } };
  const result = validatePost({ platform: "x", text: "Company X is going bankrupt.", event });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes("rumor_not_framed_as_unconfirmed"));
});

test("accepts a properly framed rumor", () => {
  const event = { verification: { isRumor: true } };
  const result = validatePost({
    platform: "x",
    text: "Unconfirmed reports suggest Company X may be facing financial trouble.",
    event,
  });
  assert.equal(result.pass, true);
});

test("rejects guaranteed-profit language", () => {
  const result = validatePost({ platform: "x", text: "This coin offers guaranteed profit!", event: {} });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes("prohibited_language"));
});
