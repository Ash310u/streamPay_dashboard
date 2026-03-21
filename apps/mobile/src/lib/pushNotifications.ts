/**
 * Push notification registration and handler for Detrix mobile app.
 * Registers device push token with Expo and stores it on the backend.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { mobileApiFetch } from "./api";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH
  })
});

/** Register for push notifications and store the token on the server */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.warn("[push] physical device required");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[push] permission not granted");
    return null;
  }

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7c3aed"
    });
  }

  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  const pushToken = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined
  });

  const token = pushToken.data;

  // Store token on backend
  try {
    await mobileApiFetch("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({
        pushToken: token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? "unknown"
      })
    });
    console.log("[push] token registered:", token.slice(0, 20));
  } catch (err) {
    console.warn("[push] token registration failed:", err);
  }

  return token;
};

/** Add a notification response listener (when user taps notification) */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/** Add a notification received listener (foreground) */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};
