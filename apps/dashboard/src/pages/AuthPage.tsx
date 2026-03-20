import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup") {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }
    } else {
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      const profile = await supabase.from("profiles").select("role").eq("id", result.data.user.id).maybeSingle();
      navigate(profile.data?.role === "merchant" ? "/app/merchant" : "/app/customer");
    }
  };

  return (
    <div className="min-h-screen bg-aurora px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-panel rounded-[36px] p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Unified access</p>
          <h1 className="mt-4 text-4xl font-semibold">One sign-in for customers and merchants.</h1>
          <p className="mt-4 text-base text-ink/70">
            The email decides the experience. Merchant accounts land on the merchant dashboard. Customer accounts land on the customer workspace.
          </p>
        </section>

        <section className="glass-panel rounded-[36px] p-8">
          <div className="flex gap-3 rounded-full bg-white/55 p-1">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${mode === item ? "bg-blush text-white" : "text-ink/70 hover:bg-white/80"}`}
              >
                {item === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink/75">Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-white/50 bg-white/55 px-4 py-3 outline-none transition focus:border-blush" />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/75">Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/50 bg-white/55 px-4 py-3 outline-none transition focus:border-blush" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/75">Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-white/50 bg-white/55 px-4 py-3 outline-none transition focus:border-blush" />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              {mode === "login" ? "Continue" : "Create account"}
            </button>
          </form>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}
              className="rounded-2xl bg-white/75 px-4 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signInWithOAuth({ provider: "github" })}
              className="rounded-2xl bg-white/75 px-4 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
            >
              Continue with GitHub
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
