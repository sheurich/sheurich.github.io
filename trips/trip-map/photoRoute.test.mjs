import test from "node:test";
import assert from "node:assert/strict";

import { buildPhotoRoute } from "./photoRoute.mjs";

test("buildPhotoRoute sorts by time and emits lat/lng pairs", () => {
  const photos = [
    { timeMs: 3, latitude: 10, longitude: -10 },
    { timeMs: 1, latitude: 20, longitude: -20 },
    { timeMs: 2, latitude: 30, longitude: -30 },
  ];

  assert.deepEqual(buildPhotoRoute(photos), [
    [20, -20],
    [30, -30],
    [10, -10],
  ]);
});

test("buildPhotoRoute drops consecutive duplicate points", () => {
  const photos = [
    { timeMs: 1, latitude: 10, longitude: -10 },
    { timeMs: 2, latitude: 10, longitude: -10 },
    { timeMs: 3, latitude: 11, longitude: -11 },
    { timeMs: 4, latitude: 11, longitude: -11 },
    { timeMs: 5, latitude: 12, longitude: -12 },
  ];

  assert.deepEqual(buildPhotoRoute(photos), [
    [10, -10],
    [11, -11],
    [12, -12],
  ]);
});

