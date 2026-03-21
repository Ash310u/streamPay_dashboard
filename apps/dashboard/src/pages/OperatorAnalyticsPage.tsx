import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch } from "../lib/api";

type AnalyticsData = {
  daily: Array<{ date: string; revenue: number; sessions: number; fees: number }>;
  byCategory: Array<{ category: string; value: number }>;
  topMerchants: Array<{ name: string; revenue: number }>;
  summary: { totalRevenue: number; totalSessions: number; totalFees: number; activeMerchants: number };
};

const COLORS = ["#7c3aed", "#ff5ea8", "#22c55e", "#f59e0b", "#06b6d4", "#e11d48"];
const formatInr = (value: number) => `INR ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatUnknownInr = (value: unknown) => formatInr(Number(value ?? 0));
const renderCategoryLabel = ({ name, percent }: { name?: string | number; percent?: number }) =>
  `${String(name ?? "other")} ${Math.round((percent ?? 0) * 100)}%`;

export const OperatorAnalyticsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["operator-analytics"],
    queryFn: () => apiFetch<AnalyticsData>("/analytics/operator"),
    refetchInterval: 30_000
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet border-t-transparent" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Revenue", value: formatInr(summary?.totalRevenue ?? 0) },
          { label: "Total Sessions", value: (summary?.totalSessions ?? 0).toLocaleString("en-IN") },
          { label: "Platform Fees", value: formatInr(summary?.totalFees ?? 0) },
          { label: "Active Merchants", value: (summary?.activeMerchants ?? 0).toLocaleString("en-IN") }
        ].map(({ label, value }) => (
          <div key={label} className="glass-panel rounded-[28px] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">{label}</p>
            <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-[32px] p-6">
        <h3 className="mb-4 text-lg font-semibold">Revenue And Sessions</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data?.daily ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => {
                if (String(name) === "Revenue") {
                  return [formatUnknownInr(value), String(name)];
                }

                return [Number(value ?? 0), String(name)];
              }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="sessions" name="Sessions" stroke="#ff5ea8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="mb-4 text-lg font-semibold">Revenue By Category</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data?.byCategory ?? []}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={88}
                label={renderCategoryLabel}
                labelLine
              >
                {(data?.byCategory ?? []).map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatUnknownInr(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="mb-4 text-lg font-semibold">Top Merchants By Revenue</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.topMerchants ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatInr(value)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(value) => formatUnknownInr(value)} />
              <Bar dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel rounded-[32px] p-6">
        <h3 className="mb-4 text-lg font-semibold">Daily Platform Fees</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.daily ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatInr(value)} />
            <Tooltip formatter={(value, name) => [formatUnknownInr(value), String(name)]} />
            <Bar dataKey="fees" name="Platform Fees" fill="#ff5ea8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
