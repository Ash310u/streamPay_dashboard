import { ArrowRight, ShieldCheck, Wallet, Waves } from "lucide-react";
import { Link } from "react-router-dom";

export const LandingPage = ({ role }: { role: "user" | "merchant" | "admin" | null }) => {
  const appHref = role === "merchant" ? "/app/merchant" : role === "admin" ? "/app/operator" : "/app/customer";

  return (
    <div className="min-h-screen bg-aurora px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="glass-panel flex items-center justify-between rounded-[32px] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ink/60">Detrix</p>
            <h1 className="text-xl font-semibold sm:text-2xl">Pay-per-use infra for physical venues</h1>
          </div>
          <div className="flex gap-3">
            <Link to="/auth" className="rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-white">
              Sign in
            </Link>
            <Link to={appHref} className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:opacity-90">
              Open app
            </Link>
          </div>
        </header>

        <section className="grid gap-6 pt-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-[40px] p-8">
            <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Fiat in. Crypto inside. Fiat out.</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-6xl">
              Modern access billing for gyms, parking, EV charging and coworking.
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-ink/70">
              Users pay in INR, billing runs on an internal crypto ledger, merchants settle in INR on T+1, and the operator tracks platform fees without exposing crypto complexity to end users.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                Start now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="rounded-full bg-white/70 px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-white">
                Live demo venues
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              { icon: Wallet, title: "Custodial wallet bridge", body: "Razorpay top-up, live rate lock, instant wallet credit." },
              { icon: Waves, title: "Streaming settlement", body: "Per-second or per-minute usage billing with QR fallback." },
              { icon: ShieldCheck, title: "Operator-grade controls", body: "RLS, audit logs, T+1 settlement and role-gated revenue views." }
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="glass-panel rounded-[28px] p-6 transition hover:-translate-y-1">
                <div className="inline-flex rounded-2xl bg-white/80 p-3">
                  <Icon className="h-5 w-5 text-blush" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
