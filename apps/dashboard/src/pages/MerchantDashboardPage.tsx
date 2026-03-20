import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArcElement, Chart as ChartJS, Legend, Tooltip as ChartTooltip } from "chart.js";
import { Doughnut, Pie } from "react-chartjs-2";
import { apiFetch } from "../lib/api";
import { createRealtimeClient } from "../lib/realtime";

ChartJS.register(ArcElement, Legend, ChartTooltip);

type MerchantAnalyticsStats = {
  totalRevenueThisMonth: number;
  totalSessionsThisMonth: number;
  averageSessionValue: number;
  platformFeePaid: number;
};

type MerchantSession = {
  id: string;
  created_at: string;
  inr_equivalent: number;
  platform_fee_inr: number;
  merchant_payout_inr: number;
  status: string;
  trigger_mode: "geofence" | "qr" | "self_checkout";
  venues?: {
    name?: string;
    city?: string;
  };
};

type Settlement = {
  id: string;
  batch_date: string;
  net_inr: number;
  status: string;
};

type Venue = {
  id: string;
  name: string;
  city: string;
};

type OccupancyCell = {
  day: number;
  hour: number;
  count: number;
};

export const MerchantDashboardPage = () => {
  const queryClient = useQueryClient();
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ["merchant-stats"],
    queryFn: () => apiFetch<MerchantAnalyticsStats>("/merchants/me/analytics")
  });
  const revenueQuery = useQuery({
    queryKey: ["merchant-revenue"],
    queryFn: () => apiFetch<MerchantSession[]>("/analytics/revenue")
  });
  const sessionsQuery = useQuery({
    queryKey: ["merchant-sessions"],
    queryFn: () => apiFetch<MerchantSession[]>("/merchants/me/sessions")
  });
  const settlementsQuery = useQuery({
    queryKey: ["merchant-settlements"],
    queryFn: () => apiFetch<Settlement[]>("/merchants/me/settlements")
  });
  const venuesQuery = useQuery({
    queryKey: ["merchant-venues"],
    queryFn: () => apiFetch<Venue[]>("/merchants/me/venues")
  });
  const occupancyQuery = useQuery({
    queryKey: ["merchant-occupancy"],
    queryFn: () => apiFetch<OccupancyCell[]>("/analytics/occupancy")
  });

  const generateQrMutation = useMutation({
    mutationFn: async () => {
      const firstVenue = venuesQuery.data?.[0];
      if (!firstVenue) {
        throw new Error("Create a venue before generating QR");
      }

      return apiFetch<{ qrCode: { nonce: string; expiresAt: string } }>(`/venues/${firstVenue.id}/qr/generate?type=entry`, {
        method: "POST"
      });
    },
    onSuccess: (payload) => {
      setQrMessage(`Entry QR ready. Nonce ${payload.qrCode.nonce.slice(0, 8)}..., expires ${new Date(payload.qrCode.expiresAt).toLocaleTimeString()}`);
    }
  });

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();
      socket.emit("subscribe:merchant", "me");

      const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["merchant-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["merchant-revenue"] });
        void queryClient.invalidateQueries({ queryKey: ["merchant-sessions"] });
        void queryClient.invalidateQueries({ queryKey: ["merchant-settlements"] });
      };

      socket.on("merchant:session_new", refresh);
      socket.on("merchant:session_ended", refresh);
      socket.on("merchant:dashboard_update", refresh);
      socket.on("billing:settled", refresh);

      socketCleanup = () => socket.disconnect();
    })();

    return () => {
      socketCleanup?.();
    };
  }, [queryClient]);

  const chartData = useMemo(() => {
    const sessions = revenueQuery.data ?? [];
    const byDay = new Map<string, { name: string; revenue: number; cumulative: number; sessions: number }>();
    let cumulative = 0;

    for (const session of sessions) {
      const name = new Date(session.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const current = byDay.get(name) ?? { name, revenue: 0, cumulative: 0, sessions: 0 };
      current.revenue += Number(session.inr_equivalent ?? 0);
      current.sessions += 1;
      byDay.set(name, current);
    }

    return [...byDay.values()].map((item) => {
      cumulative += item.revenue;
      return {
        ...item,
        cumulative
      };
    });
  }, [revenueQuery.data]);

  const triggerModeStats = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    return {
      labels: ["Geofence", "QR", "Self checkout"],
      values: [
        sessions.filter((item) => item.trigger_mode === "geofence").length,
        sessions.filter((item) => item.trigger_mode === "qr").length,
        sessions.filter((item) => item.trigger_mode === "self_checkout").length
      ]
    };
  }, [sessionsQuery.data]);

  const revenueByCity = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    const totals = new Map<string, number>();

    for (const session of sessions) {
      const key = session.venues?.city ?? "Unknown";
      totals.set(key, (totals.get(key) ?? 0) + Number(session.inr_equivalent ?? 0));
    }

    return {
      labels: [...totals.keys()],
      values: [...totals.values()]
    };
  }, [sessionsQuery.data]);

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Merchant analytics</p>
            <h2 className="mt-3 text-3xl font-semibold">Revenue, settlements, QR operations, and live session visibility.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => generateQrMutation.mutate()}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Generate QR
            </button>
          </div>
        </div>

        {qrMessage ? <p className="mt-4 rounded-2xl bg-white/55 px-4 py-3 text-sm text-ink/75">{qrMessage}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Revenue this month", `INR ${Number(statsQuery.data?.totalRevenueThisMonth ?? 0).toFixed(2)}`],
            ["Sessions this month", `${statsQuery.data?.totalSessionsThisMonth ?? 0}`],
            ["Avg session value", `INR ${Number(statsQuery.data?.averageSessionValue ?? 0).toFixed(2)}`],
            ["Platform fee paid", `INR ${Number(statsQuery.data?.platformFeePaid ?? 0).toFixed(2)}`],
            ["Pending settlement", `INR ${(settlementsQuery.data ?? []).filter((item) => item.status !== "completed").reduce((sum, item) => sum + Number(item.net_inr ?? 0), 0).toFixed(2)}`],
            ["Active users", `${(sessionsQuery.data ?? []).filter((item) => item.status === "active").length}`]
          ].map(([label, value]) => (
            <article key={label} className="rounded-[24px] bg-white/55 p-5">
              <p className="text-sm text-ink/55">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-lg font-semibold">Revenue trend</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(19, 34, 56, 0.08)" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line dataKey="revenue" stroke="#ff5ea8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-lg font-semibold">Sessions over time</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(19, 34, 56, 0.08)" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sessions" fill="#9fe4c1" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-lg font-semibold">Cumulative revenue</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(19, 34, 56, 0.08)" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area dataKey="cumulative" stroke="#74c8ff" fill="rgba(116, 200, 255, 0.35)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-6">
            <h3 className="text-lg font-semibold">Trigger mode mix</h3>
            <div className="mt-4">
              <Pie
                data={{
                  labels: triggerModeStats.labels,
                  datasets: [
                    {
                      data: triggerModeStats.values,
                      backgroundColor: ["#ff5ea8", "#74c8ff", "#9fe4c1"]
                    }
                  ]
                }}
              />
            </div>
          </div>
          <div className="glass-panel rounded-[32px] p-6">
            <h3 className="text-lg font-semibold">Revenue by city</h3>
            <div className="mt-4">
              <Doughnut
                data={{
                  labels: revenueByCity.labels.length ? revenueByCity.labels : ["No data"],
                  datasets: [
                    {
                      data: revenueByCity.values.length ? revenueByCity.values : [1],
                      backgroundColor: ["#74c8ff", "#ff5ea8", "#9fe4c1", "#f7c4df"]
                    }
                  ]
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-lg font-semibold">Session log</h3>
          <div className="mt-4 overflow-hidden rounded-[24px] bg-white/45">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/60 text-ink/55">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(sessionsQuery.data ?? []).slice(0, 8).map((session) => (
                  <tr key={session.id} className="border-t border-white/40">
                    <td className="px-4 py-3">{new Date(session.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{session.venues?.name ?? "Venue"}</td>
                    <td className="px-4 py-3">{session.trigger_mode}</td>
                    <td className="px-4 py-3">INR {Number(session.inr_equivalent ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{session.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-lg font-semibold">Settlement log</h3>
          <div className="mt-4 space-y-3">
            {(settlementsQuery.data ?? []).slice(0, 6).map((settlement) => (
              <article key={settlement.id} className="rounded-[22px] bg-white/55 p-4">
                <p className="font-medium">{settlement.batch_date}</p>
                <p className="mt-1 text-sm text-ink/65">Net payout: INR {Number(settlement.net_inr ?? 0).toFixed(2)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink/45">{settlement.status}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-lg font-semibold">Occupancy heatmap</h3>
        <div className="mt-4 grid grid-cols-6 gap-2 text-xs sm:grid-cols-8 md:grid-cols-12">
          {(occupancyQuery.data ?? []).slice(0, 48).map((cell) => (
            <div
              key={`${cell.day}-${cell.hour}`}
              className="rounded-xl p-3 text-center text-ink/75"
              style={{
                backgroundColor: `rgba(255, 94, 168, ${Math.min(0.12 + cell.count * 0.08, 0.95)})`
              }}
            >
              <div>{cell.day}</div>
              <div>{cell.hour}:00</div>
              <div>{cell.count}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
