/**
 * Background location tracking service for Detrix mobile app.
 * Uses expo-location's background task to report user location
 * to the API for geofence-based session entry/exit detection.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { mobileApiFetch } from "./api";

const TASK_NAME = "DETRIX_BACKGROUND_LOCATION";

// Define the background task
TaskManager.defineTask(TASK_NAME, async ({ data, error }: { data?: unknown; error?: { message?: string } | null }) => {
  if (error) {
    console.error("[location] background task error:", error.message);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  if (!latest) return;
  const { latitude, longitude } = latest.coords;

  try {
    await mobileApiFetch("/sessions/location-event", {
      method: "POST",
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        occurredAt: new Date(latest.timestamp).toISOString(),
        idempotencyKey: `bg_loc_${Math.round(latest.timestamp)}`
      })
    });
  } catch {
    // Silently fail — next location update will retry
  }
});

/** Request permissions and start background location tracking */
export const startBackgroundLocation = async (): Promise<boolean> => {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== "granted") {
    console.warn("[location] foreground permission denied");
    return false;
  }

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== "granted") {
    console.warn("[location] background permission denied");
    return false;
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (isTracking) return true;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,        // report every 15 seconds
    distanceInterval: 10,        // or when moved 10 meters
    deferredUpdatesInterval: 30_000,
    deferredUpdatesDistance: 20,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Detrix",
      notificationBody: "Tracking your venue session",
      notificationColor: "#7c3aed"
    }
  });

  console.log("[location] background tracking started");
  return true;
};

/** Stop background location tracking */
export const stopBackgroundLocation = async (): Promise<void> => {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
    console.log("[location] background tracking stopped");
  }
};
