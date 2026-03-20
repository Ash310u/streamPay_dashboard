import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch } from "../lib/api";
import { createRealtimeClient } from "../lib/realtime";

type OperatorStats = {
  ledger: Array<{ recorded_at: string; fee_inr: number; gross_inr: number }>;
  totalMerchants: number;
  totalUsers: number;
  activeSessions: number;
};

type OperatorLedgerEntry = {
  id?: string;
  recorded_at: string;
  fee_inr: number;
  gross_inr: number;
  session_id?: string;
  merchant_id?: string;
  venue_id?: string;
};

export const OperatorDashboardPage = () => {
  const queryClient = useQueryClient();
  const statsQuery = useQuery({
    queryKey: ["operator-stats"],
    queryFn: () => apiFetch<OperatorStats>("/admin/operator/stats")
  });
  const revenueQuery = useQuery({
    queryKey: ["operator-revenue"],
    queryFn: () => apiFetch<OperatorLedgerEntry[]>("/admin/operator/revenue")
  });
  const liveQuery = useQuery({
    queryKey: ["operator-live"],
    queryFn: () => apiFetch<OperatorLedgerEntry[]>("/admin/operator/live")
  });

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();
      socket.emit("subscribe:operator");

      const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["operator-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["operator-revenue"] });
        void queryClient.invalidateQueries({ queryKey: ["operator-live"] });
      };

      socket.on("billing:settled", refresh);
      socket.on("merchant:dashboard_update", refresh);
      socketCleanup = () => socket.disconnect();
    })();

    return () => {
      socketCleanup?.();
    };
  }, [queryClient]);

  const revenueData = revenueQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[36px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Operator control</p>
        <h1 className="mt-3 text-4xl font-semibold">Platform fee revenue and settlement oversight.</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Revenue today", `INR ${revenueData.slice(-20).reduce((sum, item) => sum + Number(item.fee_inr ?? 0), 0).toFixed(2)}`],
            ["Revenue this month", `INR ${revenueData.reduce((sum, item) => sum + Number(item.fee_inr ?? 0), 0).toFixed(2)}`],
            ["Gross volume", `INR ${revenueData.reduce((sum, item) => sum + Number(item.gross_inr ?? 0), 0).toFixed(2)}`],
            ["Merchants", `${statsQuery.data?.totalMerchants ?? 0}`],
            ["Active sessions", `${statsQuery.data?.activeSessions ?? 0}`]
          ].map(([label, value]) => (
            <article key={label} className="rounded-[24px] bg-white/60 p-5">
              <p className="text-sm text-ink/55">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="glass-panel rounded-[32px] p-6">
          <h2 className="text-xl font-semibold">Platform fee trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" />
                <XAxis dataKey="recorded_at" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Area dataKey="fee_inr" stroke="#ff5ea8" fill="rgba(255, 94, 168, 0.24)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h2 className="text-xl font-semibold">Gross volume trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" />
                <XAxis dataKey="recorded_at" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="gross_inr" fill="#8fdcc0" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h2 className="text-xl font-semibold">Live fee feed</h2>
        <div className="mt-4 overflow-hidden rounded-[24px] bg-white/55">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/65 text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Fee</th>
              </tr>
            </thead>
            <tbody>
              {(liveQuery.data ?? []).slice(0, 10).map((row, index) => (
                <tr key={`${row.session_id ?? index}`} className="border-t border-white/40">
                  <td className="px-4 py-3">{new Date(row.recorded_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.session_id ?? "Session"}</td>
                  <td className="px-4 py-3">INR {Number(row.gross_inr ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">INR {Number(row.fee_inr ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
