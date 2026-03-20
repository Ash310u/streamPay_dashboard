import { calculateCharge } from "@detrix/billing-core";
import { isPointInsideGeofence, type AnyGeofence } from "@detrix/geofence-utils";
import { isQrExpired, validateQrPayload, type SignedQrPayload } from "@detrix/qr-utils";
import type { SessionStatus } from "@detrix/shared-types";

const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  enter_detected: ["active", "closed", "disputed"],
  active: ["exit_detected", "closed", "disputed"],
  exit_detected: ["active", "closed", "disputed"],
  closed: ["disputed"],
  disputed: []
};

export class InvalidSessionTransitionError extends Error {
  constructor(from: SessionStatus, to: SessionStatus) {
    super(`Invalid transition from ${from} to ${to}`);
  }
}

export class SessionStateMachine {
  transition(from: SessionStatus, to: SessionStatus): SessionStatus {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new InvalidSessionTransitionError(from, to);
    }

    return to;
  }
}

export interface LocationEvaluationInput {
  status: SessionStatus;
  geofence: AnyGeofence;
  point: { lat: number; lng: number };
  debounceSeconds?: number;
  gracePeriodSeconds?: number;
  elapsedSinceLastTransitionSeconds: number;
}

export interface LocationEvaluationResult {
  nextStatus: SessionStatus;
  inside: boolean;
  shouldStartBilling: boolean;
  shouldStopBilling: boolean;
}

export class SessionEngineService {
  private readonly machine = new SessionStateMachine();

  evaluateLocation(input: LocationEvaluationInput): LocationEvaluationResult {
    const inside = isPointInsideGeofence(input.point, input.geofence);
    const debounceSeconds = input.debounceSeconds ?? 10;
    const gracePeriodSeconds = input.gracePeriodSeconds ?? 30;

    if (input.status === "enter_detected") {
      const nextStatus =
        inside && input.elapsedSinceLastTransitionSeconds >= debounceSeconds
          ? this.machine.transition("enter_detected", "active")
          : "enter_detected";

      return {
        nextStatus,
        inside,
        shouldStartBilling: nextStatus === "active",
        shouldStopBilling: false
      };
    }

    if (input.status === "active" && !inside) {
      return {
        nextStatus: this.machine.transition("active", "exit_detected"),
        inside,
        shouldStartBilling: false,
        shouldStopBilling: false
      };
    }

    if (input.status === "exit_detected") {
      if (inside) {
        return {
          nextStatus: this.machine.transition("exit_detected", "active"),
          inside,
          shouldStartBilling: false,
          shouldStopBilling: false
        };
      }

      const nextStatus =
        input.elapsedSinceLastTransitionSeconds >= gracePeriodSeconds
          ? this.machine.transition("exit_detected", "closed")
          : "exit_detected";

      return {
        nextStatus,
        inside,
        shouldStartBilling: false,
        shouldStopBilling: nextStatus === "closed"
      };
    }

    return {
      nextStatus: input.status,
      inside,
      shouldStartBilling: false,
      shouldStopBilling: false
    };
  }

  validateQrToken(input: { payload: SignedQrPayload; signature: string; secret: string }): boolean {
    return !isQrExpired(input.payload.expiresAt) && validateQrPayload(input.payload, input.signature, input.secret);
  }

  previewCharge(input: {
    elapsedSeconds: number;
    billingUnit: "per_second" | "per_minute" | "per_hour";
    rateCrypto: number;
    lockedRate: number;
    minimumChargeInr: number;
    maximumCapInr?: number | null;
    baseFeeInr?: number;
    platformFeeRate: number;
  }) {
    return calculateCharge(input);
  }
}

