import test from "node:test";
import assert from "node:assert/strict";

import { bucketMs, bucketTimeMs, buildBucketIndex } from "./timeBuckets.mjs";

test("bucketMs returns correct bucket sizes", () => {
  assert.equal(bucketMs("hour"), 60 * 60 * 1000);
  assert.equal(bucketMs("day"), 24 * 60 * 60 * 1000);
});

test("bucketTimeMs buckets time to the start of its window", () => {
  const t = Date.parse("2024-09-18T07:48:35.000Z");
  const hourBucket = Date.parse("2024-09-18T07:00:00.000Z");
  const dayBucket = Date.parse("2024-09-18T00:00:00.000Z");

  assert.equal(bucketTimeMs(t, "hour"), hourBucket);
  assert.equal(bucketTimeMs(t, "day"), dayBucket);
});

test("buildBucketIndex groups by bucket and sorts available times", () => {
  const items = [
    { id: "b", timeMs: Date.parse("2024-09-18T07:48:35.000Z") },
    { id: "a", timeMs: Date.parse("2024-09-18T07:12:00.000Z") },
    { id: "c", timeMs: Date.parse("2024-09-18T08:01:00.000Z") },
  ];

  const { buckets, availableTimes } = buildBucketIndex(items, "hour");
  assert.deepEqual(availableTimes, [
    Date.parse("2024-09-18T07:00:00.000Z"),
    Date.parse("2024-09-18T08:00:00.000Z"),
  ]);

  assert.equal(buckets.get(Date.parse("2024-09-18T07:00:00.000Z")).length, 2);
  assert.equal(buckets.get(Date.parse("2024-09-18T08:00:00.000Z")).length, 1);
});

