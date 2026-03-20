import type { FastifyInstance } from "fastify";
import { NotificationService } from "@detrix/notification";

export class NotificationDeliveryService {
  private readonly notificationService = new NotificationService();

  constructor(private readonly _app: FastifyInstance) {}

  async sendInApp(userId: string, title: string, body: string, type = "info") {
    await this.notificationService.createInAppNotification(userId, title, body, type);
  }

  async sendExpoPush(expoPushToken: string, title: string, body: string) {
    if (!process.env.EXPO_ACCESS_TOKEN) {
      return { skipped: true };
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        sound: "default"
      })
    });

    return response.json();
  }

  async sendEmail(email: string, subject: string, html: string) {
    if (!process.env.RESEND_API_KEY) {
      return { skipped: true };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Detrix <noreply@detrix.app>",
        to: [email],
        subject,
        html
      })
    });

    return response.json();
  }
}

