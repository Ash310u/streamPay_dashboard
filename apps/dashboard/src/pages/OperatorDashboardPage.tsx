import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "../store";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  apiSlice,
  useGetOperatorStatsQuery,
  useGetOperatorRevenueQuery,
  useGetOperatorLiveQuery,
  useGetAdminLedgerQuery,
  useGetAdminSessionsQuery,
  useRefundSessionMutation,
  useLazyExportOperatorLedgerQuery
} from "../store/api";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { createRealtimeClient } from "../lib/realtime";

type Stats = {
  totalPlatformRevenue: number;
  totalMerchants: number;
  totalSessions: number;
  totalActiveSessions: number;
  totalSettledInr: number;
};

type RevenueSeries = {
  date: string;
  platformFeeInr: number;
  merchantPayoutInr: number;
  totalInr: number;
};

type LiveSession = {
  sessionId: string;
  userId: string;
  venueId: string;
  venueName: string;
  merchantId: string;
  currentChargeInr: number;
  elapsedSeconds: number;
};

const Spinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan border-t-transparent shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
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

export const OperatorDashboardPage = () => {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<"overview" | "ledger" | "sessions">("overview");
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [triggerExport] = useLazyExportOperatorLedgerQuery();

  const { data: statsData, isLoading: isStatsLoading } = useGetOperatorStatsQuery();
  const { data: revenueData = [], isLoading: isRevenueLoading } = useGetOperatorRevenueQuery();
  const { data: liveData = [], isLoading: isLiveLoading } = useGetOperatorLiveQuery(undefined, { pollingInterval: 10000 });
  const { data: ledgerData = [], isLoading: isLedgerLoading, isError: isLedgerError, refetch: refetchLedger } = useGetAdminLedgerQuery(undefined, { skip: tab !== "ledger" });
  const { data: sessionsData = [], isLoading: isSessionsLoading, isError: isSessionsError, refetch: refetchSessions } = useGetAdminSessionsQuery(undefined, { skip: tab !== "sessions" });

  const [refundSession, { isLoading: isRefundPending }] = useRefundSessionMutation();

  const handleExportLedger = async () => {
    setExportStatus("Exporting…");
    try {
      const csv = await triggerExport().unwrap();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("✅ Exported!");
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      setExportStatus(`❌ ${err instanceof Error ? err.message : "Export failed"}`);
    }
  };

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();
      socket.emit("subscribe:operator", "admin");

      socket.on("operator:stats_update", () => {
        dispatch(apiSlice.endpoints.getOperatorStats.initiate(undefined, { forceRefetch: true }));
        dispatch(apiSlice.endpoints.getOperatorRevenue.initiate(undefined, { forceRefetch: true }));
        dispatch(apiSlice.endpoints.getOperatorLive.initiate(undefined, { forceRefetch: true }));
      });

      socketCleanup = () => socket.disconnect();
    })();

    return () => {
      socketCleanup?.();
    };
  }, [dispatch]);

  const revenuePie = useMemo(() => {
    const data = revenueData;
    const totalFee = data.reduce((s: number, r: any) => s + Number(r.platformFeeInr ?? 0), 0);
    const totalPayout = data.reduce((s: number, r: any) => s + Number(r.merchantPayoutInr ?? 0), 0);
    return [
      { name: "Platform fee", value: totalFee },
      { name: "Merchant payout", value: totalPayout }
    ];
  }, [revenueData]);

  return (
    <div className="space-y-5 text-ivory">
      <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] w-64 h-64 bg-cyan/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan font-bold">Platform operator</p>
          <h2 className="mt-3 text-3xl font-semibold text-ivory">Platform-level control & analytics.</h2>

          {isStatsLoading ? <Spinner /> : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
              {[
                ["Platform revenue", `INR ${Number(statsData?.totalPlatformRevenue ?? 0).toFixed(2)}`],
                ["Total sessions", `${statsData?.totalSessions ?? 0}`],
                ["Active sessions", `${statsData?.totalActiveSessions ?? 0}`],
                ["Total merchants", `${statsData?.totalMerchants ?? 0}`],
                ["Settled INR", `INR ${Number(statsData?.totalSettledInr ?? 0).toFixed(2)}`]
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
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-2 rounded-full bg-black/30 p-1 border border-white/5">
          {(["overview", "ledger", "sessions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition duration-300 ${tab === t ? "bg-white/10 text-ivory shadow-sm" : "bg-transparent text-slate-400 hover:text-ivory"
                }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void handleExportLedger()}
          className="ml-auto rounded-full bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-semibold text-ivory transition hover:bg-white/20 hover:text-white"
        >
          ⬇ Export ledger CSV
        </motion.button>
      </div>
      <AnimatePresence>
        {exportStatus && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-slate-400">{exportStatus}</motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "overview" && (
            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
                <h3 className="text-lg font-semibold text-ivory">Revenue trend</h3>
                {isRevenueLoading ? <Spinner /> : (
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                        <XAxis dataKey="date" stroke="#94A3B8" />
                        <YAxis stroke="#94A3B8" />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: '12px' }}
                        />
                        <Area type="monotone" dataKey="platformFeeInr" stroke="#06B6D4" fillOpacity={1} fill="url(#colorCyan)" name="Platform fee" />
                        <Area type="monotone" dataKey="totalInr" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorViolet)" name="Total" />
                        <defs>
                          <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorViolet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
                <h3 className="text-lg font-semibold text-ivory">Revenue split</h3>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenuePie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        label={({ name, value }) => `${name}: ₹${Number(value).toFixed(0)}`}
                      >
                        <Cell fill="#06B6D4" />
                        <Cell fill="#8B5CF6" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          {tab === "ledger" && (
            <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
              <h3 className="text-lg font-semibold text-ivory">Platform ledger</h3>
              {isLedgerLoading ? <Spinner /> : isLedgerError ? (
                <div className="mt-4 rounded-[22px] bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-500">
                  Failed to load ledger. <button onClick={() => void refetchLedger()} className="underline text-rose-400 hover:text-rose-300">Retry</button>
                </div>
              ) : ledgerData.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No ledger entries yet.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[24px] bg-black/20 border border-white/5">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-black/30 text-slate-400">
                      <tr>
                        {Object.keys((ledgerData)[0] ?? {}).slice(0, 6).map((key) => (
                          <th key={key} className="px-4 py-3 capitalize font-medium">{key.replace(/_/g, " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                      {(ledgerData).map((row: any, i: number) => (
                        <motion.tr variants={itemVariants} key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          {Object.values(row).slice(0, 6).map((val, j) => (
                            <td key={j} className="px-4 py-3 text-slate-300">{String(val)}</td>
                          ))}
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === "sessions" && (
            <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
              <h3 className="text-lg font-semibold text-ivory">All sessions (admin)</h3>
              {isSessionsLoading ? <Spinner /> : isSessionsError ? (
                <div className="mt-4 rounded-[22px] bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-500">
                  Failed to load sessions. <button onClick={() => void refetchSessions()} className="underline text-rose-400 hover:text-rose-300">Retry</button>
                </div>
              ) : sessionsData.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No sessions yet.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[24px] bg-black/20 border border-white/5">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-black/30 text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Session ID</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">INR Equivalent</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                      {sessionsData.map((row: any, i: number) => {
                        const id = (row as Record<string, unknown>).id as string ?? `row-${i}`;
                        const status = (row as Record<string, unknown>).status as string ?? "";
                        const inr = Number((row as Record<string, unknown>).inr_equivalent ?? 0);
                        return (
                          <motion.tr variants={itemVariants} key={id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{id.slice(0, 12)}…</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/10 text-slate-300 border border-white/10"}`}>{status}</span>
                            </td>
                            <td className="px-4 py-3 text-ivory font-medium">₹{inr.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => void refundSession(id)}
                                disabled={isRefundPending}
                                className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-60"
                              >
                                Refund
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </motion.tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Live sessions */}
      <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
        <div className="absolute right-[-10%] bottom-[-10%] w-64 h-64 bg-blush/10 blur-[80px] rounded-full pointer-events-none" />
        <h3 className="text-lg font-semibold text-ivory relative z-10">Live sessions</h3>
        {isLiveLoading ? <Spinner /> : liveData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 relative z-10">No active sessions right now.</p>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3 relative z-10">
            {liveData.map((session: any) => (
              <motion.article variants={itemVariants} key={session.sessionId} className="rounded-[22px] bg-black/20 border border-white/5 p-4 hover:border-white/10 transition-all hover:translate-y-[-2px] hover:shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                <p className="font-semibold text-ivory">{session.venueName}</p>
                <p className="mt-1 text-sm text-cyan font-medium">
                  INR {Number(session.currentChargeInr ?? 0).toFixed(2)} <span className="text-slate-500 font-normal">· {Math.floor(Number(session.elapsedSeconds ?? 0) / 60)}m</span>
                </p>
                <p className="mt-1 text-xs text-slate-500 font-mono">User: {session.userId.slice(0, 8)}…</p>
              </motion.article>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
};
