import test from "node:test";
import assert from "node:assert/strict";

import { computePlayIntervalMs } from "./slideshowTiming.mjs";

test("computePlayIntervalMs uses 4s base for 1x", () => {
  assert.equal(computePlayIntervalMs(1), 8000);
});

test("computePlayIntervalMs scales with multiplier and clamps", () => {
  assert.equal(computePlayIntervalMs(2), 4000);
  assert.equal(computePlayIntervalMs(8), 1000);
  assert.equal(computePlayIntervalMs(1000), 250);
});
