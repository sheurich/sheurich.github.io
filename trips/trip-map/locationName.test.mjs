import test from "node:test";
import assert from "node:assert/strict";

import { formatLatLng, pickLocationName } from "./locationName.mjs";

test("formatLatLng formats degrees with hemisphere", () => {
  assert.equal(formatLatLng(35.1234, -83.5678), "35.123°N, 83.568°W");
  assert.equal(formatLatLng(-12.5, 7.25), "12.500°S, 7.250°E");
});

test("pickLocationName prefers city/town/village + state", () => {
  const json = {
    address: {
      city: "Asheville",
      state: "North Carolina",
      country_code: "us",
    },
  };
  assert.equal(pickLocationName(json), "Asheville, North Carolina");
});

test("pickLocationName falls back sensibly", () => {
  assert.equal(
    pickLocationName({ address: { county: "Piscataquis County", country_code: "us" } }),
    "Piscataquis County"
  );
  assert.equal(pickLocationName({ display_name: "Foo Bar" }), "Foo Bar");
  assert.equal(pickLocationName({}), null);
});

