import type { ReactNode } from "react";
import { Bell, CreditCard, LayoutDashboard, LogOut, MapPinned, Receipt, ScanQrCode, ShieldCheck, Wallet } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useLogoutMutation } from "../store/api";
import { motion } from "framer-motion";
import { useAppSelector } from "../store";
import { selectAuthRole } from "../store/authSlice";

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
  children
}: {
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [logout] = useLogoutMutation();
  const role = useAppSelector(selectAuthRole);
  const links = role ? navByRole[role] : navByRole.user;

  return (
    <div className="min-h-screen bg-obsidian px-4 py-5 text-ivory sm:px-6 relative overflow-hidden">
      {/* Subtle Mesh/Orb Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blush/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-panel rounded-[32px] p-5 lg:w-72 border border-white/5 bg-charcoal/60 shadow-glass"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] font-bold text-blush">Detrix</p>
              <h1 className="text-xl font-semibold mt-1">Fiat-first access</h1>
            </div>
            <button
              className="rounded-full bg-white/10 p-2.5 transition-all outline-none hover:bg-white/20 hover:scale-105 active:scale-95 text-white"
              onClick={async () => {
                try { await logout().unwrap(); } catch { /* ignore logout errors */ }
                await supabase.auth.signOut();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-8 space-y-2">
            {links.map(({ href, label, icon: Icon }) => {
              const isActive = location.pathname === href;
              return (
                <Link
                  key={label}
                  to={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 outline-none ${isActive
                      ? "bg-blush/20 text-blush border border-blush/20 shadow-sm"
                      : "bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </motion.aside>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};
