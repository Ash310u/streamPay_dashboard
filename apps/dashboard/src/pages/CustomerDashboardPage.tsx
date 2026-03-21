import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { createRealtimeClient } from "../lib/realtime";

type Wallet = {
  balance_crypto: number;
  balance_inr_equivalent: number;
  locked_balance: number;
  currency_code: string;
};

type TopUpOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mode: "live" | "demo";
};

type Session = {
  id: string;
  created_at: string;
  inr_equivalent: number;
  duration_seconds: number;
  status: string;
  venue_id: string;
  venues?: {
    name?: string;
    city?: string;
  };
};

type ChargeSnapshot = {
  sessionId: string;
  status: string;
  elapsedSeconds: number;
  billingUnit: string;
  lockedRate: number;
  currentChargeInr: number;
  currentChargeCrypto: number;
  merchantPayoutInr: number;
  platformFeeInr: number;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export const CustomerDashboardPage = () => {
  const queryClient = useQueryClient();
  const walletQuery = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => apiFetch<Wallet>("/wallet/balance")
  });
  const sessionsQuery = useQuery({
    queryKey: ["customer-sessions"],
    queryFn: () => apiFetch<Session[]>("/users/me/sessions")
  });
  const activeSessionQuery = useQuery({
    queryKey: ["active-session"],
    queryFn: () => apiFetch<Session | null>("/sessions/active")
  });
  const activeChargeQuery = useQuery({
    queryKey: ["active-session-charge", activeSessionQuery.data?.id],
    queryFn: () => apiFetch<ChargeSnapshot>(`/sessions/${activeSessionQuery.data!.id}/charge`),
    enabled: !!activeSessionQuery.data?.id,
    refetchInterval: 5_000
  });
  const notificationsQuery = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => apiFetch<Notification[]>("/users/me/notifications")
  });

  const topUpMutation = useMutation({
    mutationFn: async (amountInr: number) => {
      const order = await apiFetch<TopUpOrder>("/wallet/topup/order", {
        method: "POST",
        body: JSON.stringify({
          amountInr,
          currency: "INR"
        })
      });

      if (order.mode === "live") {
        throw new Error("Live Razorpay web checkout is not configured in this local build yet");
      }

      return apiFetch<Wallet>("/wallet/topup/verify", {
        method: "POST",
        body: JSON.stringify({
          amountInr,
          paymentId: order.orderId
        })
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/sessions/${sessionId}/checkout`, {
        method: "POST"
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["active-session"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    }
  });

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();

      socket.on("session:started", () => {
        void queryClient.invalidateQueries({ queryKey: ["active-session"] });
        void queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
        void queryClient.invalidateQueries({ queryKey: ["active-session-charge"] });
      });

      socket.on("session:closed", () => {
        void queryClient.invalidateQueries({ queryKey: ["active-session"] });
        void queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
        void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
        void queryClient.invalidateQueries({ queryKey: ["active-session-charge"] });
      });

      socket.on("billing:charge_update", () => {
        void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
        void queryClient.invalidateQueries({ queryKey: ["active-session-charge"] });
      });

      socket.on("billing:settled", () => {
        void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      });

      socketCleanup = () => socket.disconnect();
    })();

    return () => {
      socketCleanup?.();
    };
  }, [queryClient]);

  const stats = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    const totalSpent = sessions.reduce((sum, session) => sum + Number(session.inr_equivalent ?? 0), 0);
    const averageDuration = sessions.length
      ? Math.round(sessions.reduce((sum, session) => sum + Number(session.duration_seconds ?? 0), 0) / sessions.length / 60)
      : 0;

    return {
      totalSessions: sessions.length,
      totalSpent,
      averageDuration
    };
  }, [sessionsQuery.data]);

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Customer workspace</p>
        <h2 className="mt-3 text-3xl font-semibold">Wallet, live access, receipts, and notifications.</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Wallet balance", `INR ${Number(walletQuery.data?.balance_inr_equivalent ?? 0).toFixed(2)}`],
            ["Crypto balance", `${Number(walletQuery.data?.balance_crypto ?? 0).toFixed(4)} ${walletQuery.data?.currency_code ?? "USDC"}`],
            ["Total sessions", `${stats.totalSessions}`],
            ["Avg duration", `${stats.averageDuration} min`]
          ].map(([label, value]) => (
            <article key={label} className="rounded-[24px] bg-white/55 p-5 transition hover:-translate-y-1">
              <p className="text-sm text-ink/55">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Recent usage</h3>
            <button
              onClick={() => topUpMutation.mutate(500)}
              className="rounded-full bg-blush px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Add INR 500
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-[24px] bg-white/45">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/60 text-ink/55">
                <tr>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(sessionsQuery.data ?? []).map((session) => (
                  <tr key={session.id} className="border-t border-white/40">
                    <td className="px-4 py-3 text-ink/75">{session.venues?.name ?? session.venue_id}</td>
                    <td className="px-4 py-3 text-ink/75">{new Date(session.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/75">{Math.max(1, Math.round(Number(session.duration_seconds ?? 0) / 60))} min</td>
                    <td className="px-4 py-3 text-ink/75">INR {Number(session.inr_equivalent ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink/75">{session.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-panel rounded-[32px] p-6">
            <h3 className="text-xl font-semibold">Live session</h3>
            {activeSessionQuery.data ? (
              <div className="mt-4 space-y-3 rounded-[24px] bg-white/55 p-5">
                <p className="text-sm text-ink/55">Active venue</p>
                <p className="text-2xl font-semibold">{activeSessionQuery.data.venues?.name ?? activeSessionQuery.data.venue_id}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-ink/50">Current charge</p>
                    <p className="mt-2 text-xl font-semibold">
                      INR {Number(activeChargeQuery.data?.currentChargeInr ?? activeSessionQuery.data.inr_equivalent ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-ink/50">Elapsed</p>
                    <p className="mt-2 text-xl font-semibold">
                      {Math.floor(Number(activeChargeQuery.data?.elapsedSeconds ?? 0) / 60)}m {Number(activeChargeQuery.data?.elapsedSeconds ?? 0) % 60}s
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-ink/50">Locked rate</p>
                    <p className="mt-2 text-xl font-semibold">
                      INR {Number(activeChargeQuery.data?.lockedRate ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => checkoutMutation.mutate(activeSessionQuery.data!.id)}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  End session
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-[24px] bg-white/55 p-5 text-sm text-ink/70">No active session. Start via geofence or QR from the mobile app.</p>
            )}
          </div>

          <div className="glass-panel rounded-[32px] p-6">
            <h3 className="text-xl font-semibold">Notifications</h3>
            <div className="mt-4 space-y-3">
              {(notificationsQuery.data ?? []).slice(0, 4).map((notification) => (
                <article key={notification.id} className="rounded-[22px] bg-white/55 p-4">
                  <p className="font-medium">{notification.title}</p>
                  <p className="mt-1 text-sm text-ink/65">{notification.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
