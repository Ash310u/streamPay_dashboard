import { useMemo, useState } from "react";
import { useGetMerchantSessionsQuery, useLazyExportMerchantRevenueQuery } from "../store/api";

export const MerchantLiveSessionsPage = () => {
  const [filter, setFilter] = useState<"all" | "active" | "closed">("active");
  const [triggerExport] = useLazyExportMerchantRevenueQuery();

  const { data: sessions = [], isLoading, isError, refetch } = useGetMerchantSessionsQuery(filter === "all" ? undefined : filter, {
    pollingInterval: 10000
  });

  const filtered = useMemo(() => sessions, [sessions]);

  const calcDuration = (entry: string) => {
    const secs = Math.floor((Date.now() - new Date(entry).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const downloadCsv = async () => {
    try {
      const csv = await triggerExport().unwrap();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback to local CSV
      const header = "Session ID,User ID,Venue ID,Status,Entry Time,INR Charged,Crypto Charged\n";
      const rows = sessions.map((s) =>
        [s.id, s.user_id, s.venue_id, s.status, s.entry_time, s.inr_equivalent, s.crypto_charged].join(",")
      );
      const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Live & recent</p>
          <h2 className="mt-1 text-3xl font-semibold">Sessions</h2>
        </div>
        <div className="flex gap-2">
          {(["all", "active", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === f ? "bg-violet text-white" : "bg-white/55 text-ink"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button
            onClick={() => void refetch()}
            className="rounded-full bg-white/55 px-4 py-2 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => void downloadCsv()}
            className="rounded-full bg-blush px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-sm text-rose-600">Failed to load sessions.</p>
          <button onClick={() => void refetch()} className="mt-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-[32px] p-12 text-center text-ink/55">
          No {filter !== "all" ? filter : ""} sessions found.
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-[32px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-left text-xs uppercase tracking-[0.25em] text-ink/50">
                <th className="px-5 py-4">Session</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4">INR Charged</th>
                <th className="px-5 py-4">Crypto</th>
                <th className="px-5 py-4">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-white/10 transition hover:bg-white/10">
                  <td className="px-5 py-3 font-mono text-xs text-ink/70">{s.id.slice(0, 12)}…</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : s.status === "closed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink/70">
                    {s.status === "active" ? calcDuration(s.entry_time) : "—"}
                  </td>
                  <td className="px-5 py-3 font-semibold">₹{Number(s.inr_equivalent).toFixed(2)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink/60">
                    {Number(s.crypto_charged).toFixed(6)}
                  </td>
                  <td className="px-5 py-3 text-ink/65">{s.trigger_mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
