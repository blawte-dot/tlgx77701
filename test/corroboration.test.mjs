import { test } from "node:test";
import assert from "node:assert/strict";
import { annotateCorroboration } from "../src/events/dedupe.mjs";

test("single-source story gets corroboration count of 1", () => {
  const result = annotateCorroboration([{ title: "Ethereum completes network upgrade", source: "A" }]);
  assert.equal(result[0].corroboratingSources, 1);
});

test("same story from two different sources counts as 2", () => {
  const result = annotateCorroboration([
    { title: "Bitcoin ETF sees record inflows this week", source: "A" },
    { title: "Bitcoin ETF records massive inflows this week", source: "B" },
  ]);
  assert.equal(result[0].corroboratingSources, 2);
  assert.equal(result[1].corroboratingSources, 2);
});

test("unrelated stories are not grouped together", () => {
  const result = annotateCorroboration([
    { title: "Ethereum completes network upgrade", source: "A" },
    { title: "Fed signals possible rate cut next quarter", source: "B" },
  ]);
  assert.equal(result[0].corroboratingSources, 1);
  assert.equal(result[1].corroboratingSources, 1);
});

test("same source repeating itself does not inflate corroboration count", () => {
  const result = annotateCorroboration([
    { title: "Bitcoin ETF sees record inflows this week", source: "A" },
    { title: "Bitcoin ETF sees record inflows again this week", source: "A" },
  ]);
  assert.equal(result[0].corroboratingSources, 1);
});
