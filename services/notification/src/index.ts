import { createServiceSupabaseClient } from "@detrix/supabase-client";

const logger = {
  info: (payload: unknown) => console.info(payload),
  warn: (payload: unknown) => console.warn(payload)
};

// ── Expo Push Notification ─────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const token = process.env.EXPO_ACCESS_TOKEN;

  if (!token) {
    logger.warn({ msg: "expo_push_not_configured" });
    return;
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(messages)
  });

  if (!response.ok) {
    logger.warn({ msg: "expo_push_delivery_failed", status: response.status });
  } else {
    logger.info({ msg: "expo_push_sent", count: messages.length });
  }
}

// ── Resend Email ────────────────────────────────────────────────────────────

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn({ msg: "resend_not_configured" });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: "Detrix <noreply@detrix.app>",
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    logger.warn({ msg: "resend_delivery_failed", to, status: response.status });
  } else {
    logger.info({ msg: "resend_email_sent", to });
  }
}

// ── NotificationService ─────────────────────────────────────────────────────

export class NotificationService {
  private readonly supabase = createServiceSupabaseClient();

  /** Persist in-app notification and trigger push + email if tokens are available */
  async createInAppNotification(
    userId: string,
    title: string,
    body: string,
    type = "info"
  ) {
    // Persist
    await this.supabase.from("notifications").insert({ user_id: userId, title, body, type });

    // Try push
    await this.sendPushToUser(userId, title, body, { type });

    return { userId, title, type };
  }

  /** Send push notification to user's registered Expo token(s) */
  async sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    const { data: tokens } = await this.supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (!tokens?.length) return;

    await sendExpoPush(
      tokens.map((row) => ({
        to: row.token,
        title,
        body,
        ...(data ? { data } : {})
      }))
    );
  }

  /** Send settlement receipt email to merchant */
  async sendSettlementEmail(merchantEmail: string, batchDate: string, netInr: number, payoutId?: string) {
    const subject = `Detrix Settlement — ${batchDate}`;
    const html = `
      <h2>Settlement Processed</h2>
      <p>Your T+1 settlement for <strong>${batchDate}</strong> has been processed.</p>
      <table>
        <tr><td>Net payout</td><td><strong>₹${netInr.toFixed(2)}</strong></td></tr>
        ${payoutId ? `<tr><td>Payout reference</td><td>${payoutId}</td></tr>` : ""}
      </table>
      <p>Funds will reach your bank account within 1 business day (NEFT).</p>
      <p style="color:#888;font-size:12px">Detrix Payment Platform · This is an automated message.</p>
    `;
    await sendResendEmail(merchantEmail, subject, html);
  }

  /** Send wallet top-up confirmation email */
  async sendTopUpEmail(userEmail: string, inrAmount: number, paymentId: string) {
    const subject = "Detrix Wallet Top-Up Confirmed";
    const html = `
      <h2>Top-Up Successful</h2>
      <p>₹${inrAmount.toFixed(2)} has been credited to your Detrix wallet.</p>
      <p>Payment ID: <code>${paymentId}</code></p>
    `;
    await sendResendEmail(userEmail, subject, html);
  }
}
