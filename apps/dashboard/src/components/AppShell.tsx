import type { ReactNode } from "react";
import { Bell, CreditCard, LayoutDashboard, LogOut, MapPinned, Receipt, ScanQrCode, ShieldCheck, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const navByRole = {
  user: [
    { href: "/app/customer", label: "Overview", icon: LayoutDashboard },
    { href: "/app/customer/venues", label: "Venues", icon: MapPinned },
    { href: "/app/customer", label: "Wallet", icon: Wallet },
    { href: "/app/customer", label: "Sessions", icon: ScanQrCode }
  ],
  merchant: [
    { href: "/app/merchant", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/merchant/venues", label: "Venues", icon: MapPinned },
    { href: "/app/merchant/geofences", label: "Geofences", icon: MapPinned },
    { href: "/app/merchant/pricing", label: "Pricing", icon: CreditCard },
    { href: "/app/merchant/sessions", label: "Sessions", icon: ScanQrCode },
    { href: "/app/merchant/settlements", label: "Settlements", icon: Receipt },
    { href: "/app/merchant/tax", label: "Tax", icon: CreditCard },
    { href: "/app/merchant", label: "Alerts", icon: Bell }
  ],
  admin: [
    { href: "/app/operator", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/operator/merchants", label: "Merchants", icon: ShieldCheck },
    { href: "/app/operator/settlements", label: "Settlements", icon: Receipt },
    { href: "/app/operator/analytics", label: "Revenue", icon: CreditCard },
    { href: "/app/operator", label: "Alerts", icon: Bell }
  ]
} as const;

export const AppShell = ({
  role,
  children
}: {
  role: "user" | "merchant" | "admin" | null;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const links = role ? navByRole[role] : navByRole.user;

  return (
    <div className="min-h-screen bg-aurora px-4 py-5 text-ink sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
        <aside className="glass-panel rounded-[32px] p-5 lg:w-72">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-ink/60">Detrix</p>
              <h1 className="text-2xl font-semibold">Fiat-first access</h1>
            </div>
            <button
              className="rounded-full bg-white/70 p-3 transition hover:-translate-y-0.5 hover:bg-white"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-8 space-y-3">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                to={href}
                className="flex items-center gap-3 rounded-2xl bg-white/45 px-4 py-3 text-sm font-medium text-ink/80 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};
