import * as Notifications from "expo-notifications";
import { mobileApiFetch } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export const registerForPushNotifications = async () => {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  try {
    await mobileApiFetch("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({
        pushToken: token.data,
        platform: "expo",
        deviceName: "mobile"
      })
    });
  } catch {
    // Local/dev environments may not have the backend route wired to storage yet.
  }
  return token.data;
};

