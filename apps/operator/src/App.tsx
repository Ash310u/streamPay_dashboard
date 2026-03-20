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

const data = [
  { day: "Mon", fee: 840, gross: 168000, sessions: 492 },
  { day: "Tue", fee: 920, gross: 184000, sessions: 531 },
  { day: "Wed", fee: 1014, gross: 202800, sessions: 582 },
  { day: "Thu", fee: 968, gross: 193600, sessions: 548 },
  { day: "Fri", fee: 1122, gross: 224400, sessions: 621 }
];

export const App = () => {
  return (
    <div className="min-h-screen px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="glass-panel rounded-[36px] p-6">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Operator control</p>
          <h1 className="mt-3 text-4xl font-semibold">Platform fee revenue and settlement oversight.</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Revenue today", "₹1,122"],
              ["Revenue this month", "₹28,430"],
              ["Gross volume today", "₹2,24,400"],
              ["Sessions today", "621"],
              ["Active sessions", "96"]
            ].map(([label, value]) => (
              <article key={label} className="rounded-[24px] bg-white/60 p-5">
                <p className="text-sm text-slate-500">{label}</p>
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
                <AreaChart data={data}>
                  <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area dataKey="fee" stroke="#ff5ea8" fill="rgba(255, 94, 168, 0.24)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-6">
            <h2 className="text-xl font-semibold">Sessions per day</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sessions" fill="#8fdcc0" radius={[12, 12, 0, 0]} />
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
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["15:05", "Workbay", "₹412.00", "₹2.06", "QR"],
                  ["15:04", "Volt Charge", "₹96.00", "₹0.48", "Geofence"],
                  ["15:03", "FlexGym", "₹188.00", "₹0.94", "Geofence"]
                ].map((row) => (
                  <tr key={row.join("-")} className="border-t border-white/40">
                    {row.map((cell) => (
                      <td key={cell} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
