import assert from "node:assert/strict";
import test from "node:test";
import { SessionEngineService } from "./index.js";

test("transitions from enter_detected to active after debounce", () => {
  const service = new SessionEngineService();
  const result = service.evaluateLocation({
    status: "enter_detected",
    geofence: {
      type: "circle",
      center: { lat: 12.9716, lng: 77.5946 },
      radiusMeters: 100
    },
    point: { lat: 12.9716, lng: 77.5946 },
    elapsedSinceLastTransitionSeconds: 11
  });

  assert.equal(result.nextStatus, "active");
});

