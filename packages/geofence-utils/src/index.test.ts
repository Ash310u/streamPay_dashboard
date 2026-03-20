import assert from "node:assert/strict";
import test from "node:test";
import { isPointInsideCircle } from "./index.js";

test("circle geofence contains center point", () => {
  const inside = isPointInsideCircle(
    { lat: 12.9716, lng: 77.5946 },
    {
      type: "circle",
      center: { lat: 12.9716, lng: 77.5946 },
      radiusMeters: 25
    }
  );

  assert.equal(inside, true);
});

