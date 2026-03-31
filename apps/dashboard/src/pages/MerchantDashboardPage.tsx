import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  apiSlice,
  useGetProfileQuery,
  useGetMerchantQuery,
  useGetMerchantStatsQuery,
  useGetMerchantRevenueQuery,
  useGetMerchantSessionsQuery,
  useGetMerchantSettlementsQuery,
  useGetMerchantVenuesQuery,
  useGetMerchantOccupancyQuery,
  useGetMerchantTaxSummaryQuery,
  useGenerateVenueQrMutation,
  useLazyExportMerchantRevenueQuery,
  type Profile,
  type Merchant
} from "../store/api";
import { selectMerchantDashboard, setMerchantDashboardExportStatus, setMerchantDashboardQrMessage } from "../store/slices/merchantDashboardSlice";
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

const Spinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blush border-t-transparent shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
  </div>
);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const MerchantDashboardPage = () => {
  const dispatch = useAppDispatch();
  const { qrMessage, exportStatus } = useAppSelector(selectMerchantDashboard);

  const { data: profile } = useGetProfileQuery();
  const [triggerExport] = useLazyExportMerchantRevenueQuery();
  const { data: merchantData } = useGetMerchantQuery();
  const { data: statsData, isLoading: isStatsLoading } = useGetMerchantStatsQuery();
  const { data: revenueData = [] } = useGetMerchantRevenueQuery();
  const { data: sessionsData = [], isLoading: isSessionsLoading } = useGetMerchantSessionsQuery();
  const { data: settlementsData = [], isLoading: isSettlementsLoading } = useGetMerchantSettlementsQuery();
  const { data: venuesData = [] } = useGetMerchantVenuesQuery();
  const { data: occupancyData = [], isLoading: isOccupancyLoading } = useGetMerchantOccupancyQuery();
  const { data: taxSummaryData } = useGetMerchantTaxSummaryQuery();

  const [generateQr, { isLoading: isGenerateQrPending }] = useGenerateVenueQrMutation();

  const handleExportCsv = async () => {
    dispatch(setMerchantDashboardExportStatus("Exporting…"));
    try {
      const csv = await triggerExport().unwrap();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      dispatch(setMerchantDashboardExportStatus("✅ Exported!"));
      setTimeout(() => dispatch(setMerchantDashboardExportStatus(null)), 3000);
    } catch (err) {
      dispatch(setMerchantDashboardExportStatus(`❌ ${err instanceof Error ? err.message : "Export failed"}`));
    }
  };

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();
      socket.emit("subscribe:merchant", "me");

      const refresh = () => {
        dispatch(apiSlice.endpoints.getMerchantStats.initiate(undefined, { forceRefetch: true }));
        dispatch(apiSlice.endpoints.getMerchantRevenue.initiate(undefined, { forceRefetch: true }));
        dispatch(apiSlice.endpoints.getMerchantSessions.initiate(undefined, { forceRefetch: true }));
        dispatch(apiSlice.endpoints.getMerchantSettlements.initiate(undefined, { forceRefetch: true }));
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
  }, [dispatch]);

  const chartData = useMemo(() => {
    const sessions = revenueData;
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
  }, [revenueData]);

  const triggerModeStats = useMemo(() => {
    const sessions = sessionsData;
    return {
      labels: ["Geofence", "QR", "Self checkout"],
      values: [
        sessions.filter((item: any) => item.trigger_mode === "geofence").length,
        sessions.filter((item: any) => item.trigger_mode === "qr").length,
        sessions.filter((item: any) => item.trigger_mode === "self_checkout").length
      ]
    };
  }, [sessionsData]);

  const revenueByCity = useMemo(() => {
    const sessions = sessionsData;
    const totals = new Map<string, number>();

    for (const session of sessions) {
      const key = (session as any).venues?.city ?? "Unknown";
      totals.set(key, (totals.get(key) ?? 0) + Number(session.inr_equivalent ?? 0));
    }

    return {
      labels: [...totals.keys()],
      values: [...totals.values()]
    };
  }, [sessionsData]);

  return (
    <div className="space-y-5 text-ivory">
      {/* Merchant profile card */}
      <AnimatePresence>
        {merchantData && (
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blush/20 text-sm font-bold text-blush shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                {(merchantData.business_name?.[0] ?? "M").toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-ivory">{merchantData.business_name}</p>
                <p className="text-xs text-slate-400">{merchantData.business_type} · Settlement: <span className="text-emerald-400">{merchantData.settlement_status}</span></p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
        <div className="absolute right-[-10%] top-[-10%] w-64 h-64 bg-cyan/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end relative z-10">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan font-bold">Merchant analytics</p>
            <h2 className="mt-3 text-3xl font-semibold text-ivory">Revenue, settlements, QR operations, and live visibility.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                const firstVenue = venuesData[0];
                if (!firstVenue) {
                  dispatch(setMerchantDashboardQrMessage("Create a venue before generating QR"));
                  return;
                }
                try {
                  const res = await generateQr({ venueId: firstVenue.id, type: "entry" }).unwrap();
                  dispatch(
                    setMerchantDashboardQrMessage(
                      `Entry QR ready. Nonce ${res.qrCode.nonce.slice(0, 8)}..., expires ${new Date(res.qrCode.expiresAt).toLocaleTimeString()}`
                    )
                  );
                } catch (e: any) {
                  dispatch(setMerchantDashboardQrMessage(e.message || "Failed to generate"));
                }
              }}
              disabled={isGenerateQrPending}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:bg-blush/90 transition disabled:opacity-60 disabled:hover:scale-100"
            >
              {isGenerateQrPending ? "Generating…" : "Generate QR"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void handleExportCsv()}
              className="rounded-full bg-white/10 border border-white/10 px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-white/20 hover:text-white"
            >
              ⬇ Export CSV
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {qrMessage && (
            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 text-sm text-cyan">
              {qrMessage}
            </motion.p>
          )}
          {exportStatus && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-slate-400">
              {exportStatus}
            </motion.p>
          )}
        </AnimatePresence>

        {isStatsLoading ? <Spinner /> : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6 relative z-10">
            {[
              ["Revenue this month", `INR ${Number(statsData?.totalRevenueThisMonth ?? 0).toFixed(2)}`],
              ["Sessions this month", `${statsData?.totalSessionsThisMonth ?? 0}`],
              ["Avg session value", `INR ${Number(statsData?.averageSessionValue ?? 0).toFixed(2)}`],
              ["Platform fee paid", `INR ${Number(statsData?.platformFeePaid ?? 0).toFixed(2)}`],
              ["Pending settlement", `INR ${(settlementsData).filter((item: any) => item.status !== "completed").reduce((sum: number, item: any) => sum + Number(item.net_inr ?? 0), 0).toFixed(2)}`],
              ["Active users", `${(sessionsData).filter((item: any) => item.status === "active").length}`]
            ].map(([label, value]) => (
              <motion.article
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.02 }}
                key={label}
                className="rounded-[24px] bg-black/20 border border-white/5 p-5 transition-shadow hover:shadow-xl hover:shadow-cyan/5 hover:border-white/10"
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-ivory">{value}</p>
              </motion.article>
            ))}
          </motion.div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
          <h3 className="text-lg font-semibold text-ivory">Revenue trend</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: '12px' }}
                  itemStyle={{ color: '#06B6D4' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#06B6D4" strokeWidth={3} dot={{ fill: '#06B6D4', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#8B5CF6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
          <h3 className="text-lg font-semibold text-ivory">Sessions over time</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: '12px' }}
                  itemStyle={{ color: '#8B5CF6' }}
                />
                <Bar dataKey="sessions" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
          <h3 className="text-lg font-semibold text-ivory">Cumulative revenue</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#10B981" fillOpacity={1} fill="url(#colorUv)" />
                <defs>
                  <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-ivory">Trigger mode mix</h3>
            <div className="mt-4 flex-1 flex items-center justify-center">
              <div className="w-full max-w-[200px]">
                <Pie
                  data={{
                    labels: triggerModeStats.labels,
                    datasets: [
                      {
                        data: triggerModeStats.values,
                        backgroundColor: ["#06B6D4", "#8B5CF6", "#10B981"],
                        borderWidth: 0,
                        hoverOffset: 4
                      }
                    ]
                  }}
                  options={{
                    plugins: { legend: { labels: { color: '#94A3B8' } } }
                  }}
                />
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-ivory">Revenue by city</h3>
            <div className="mt-4 flex-1 flex items-center justify-center">
              <div className="w-full max-w-[200px]">
                <Doughnut
                  data={{
                    labels: revenueByCity.labels.length ? revenueByCity.labels : ["No data"],
                    datasets: [
                      {
                        data: revenueByCity.values.length ? revenueByCity.values : [1],
                        backgroundColor: ["#8B5CF6", "#06B6D4", "#10B981", "#F43F5E"],
                        borderWidth: 0,
                        hoverOffset: 4
                      }
                    ]
                  }}
                  options={{
                    plugins: { legend: { labels: { color: '#94A3B8' } } },
                    cutout: '70%'
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
          <h3 className="text-lg font-semibold text-ivory">Session log</h3>
          {isSessionsLoading ? <Spinner /> : sessionsData.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No sessions yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[24px] bg-black/20 border border-white/5">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/30 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Venue</th>
                    <th className="px-4 py-3 font-medium">Trigger</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                  {sessionsData.slice(0, 8).map((session: any) => (
                    <motion.tr variants={itemVariants} key={session.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-slate-400">{new Date(session.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ivory font-medium">{(session as any).venues?.name ?? "Venue"}</td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{session.trigger_mode.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-ivory">INR {Number(session.inr_equivalent ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${session.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" :
                            session.status === "disputed" ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                              "bg-white/10 text-slate-300 border border-white/10"
                          }`}>{session.status}</span>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
            <div className="absolute left-[-20%] bottom-[-20%] w-48 h-48 bg-blush/10 blur-[60px] rounded-full pointer-events-none" />
            <h3 className="text-lg font-semibold text-ivory relative z-10">Settlement log</h3>
            {isSettlementsLoading ? <Spinner /> : settlementsData.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 relative z-10">No settlements yet.</p>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-4 space-y-3 relative z-10">
                {settlementsData.slice(0, 6).map((settlement: any) => (
                  <motion.article variants={itemVariants} key={settlement.id} className="rounded-[22px] bg-black/20 border border-white/5 p-4 hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-ivory">{settlement.batch_date}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-cyan">{settlement.status}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">INR {Number(settlement.net_inr ?? 0).toFixed(2)}</p>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </div>

          {/* Inline tax summary */}
          {taxSummaryData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
              <h3 className="text-lg font-semibold text-ivory relative z-10">Tax summary</h3>
              <pre className="mt-4 overflow-auto rounded-[22px] bg-black/40 border border-white/5 p-4 text-xs text-slate-300 relative z-10 font-mono">
                {JSON.stringify(taxSummaryData, null, 2)}
              </pre>
            </motion.div>
          )}
        </div>
      </section>

      <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
        <h3 className="text-lg font-semibold text-ivory">Occupancy heatmap</h3>
        {isOccupancyLoading ? <Spinner /> : occupancyData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No occupancy data yet.</p>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-4 grid grid-cols-6 gap-2 text-xs sm:grid-cols-8 md:grid-cols-12">
            {occupancyData.slice(0, 48).map((cell: any) => (
              <motion.div
                variants={itemVariants}
                key={`${cell.day}-${cell.hour}`}
                className="rounded-xl p-3 text-center text-ivory font-medium transition-transform hover:scale-105"
                style={{
                  backgroundColor: `rgba(139, 92, 246, ${Math.min(0.12 + cell.count * 0.08, 0.95)})`,
                  boxShadow: `0 0 ${cell.count * 2}px rgba(139, 92, 246, ${cell.count * 0.1})`
                }}
              >
                <div className="opacity-70 text-[10px]">{cell.day}</div>
                <div>{cell.hour}:00</div>
                <div className="mt-1 font-bold">{cell.count}</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
};
