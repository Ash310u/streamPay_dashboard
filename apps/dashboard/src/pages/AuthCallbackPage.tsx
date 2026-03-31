import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAppDispatch } from "../store";
import { getAppPathForRole, syncAuthSession } from "../store/authSlice";

export const AuthCallbackPage = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Missing authentication tokens. Please try logging in again.");
      return;
    }

    void (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        const authState = await dispatch(syncAuthSession({ session: data.session })).unwrap();
        navigate(getAppPathForRole(authState.role), { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete authentication");
      }
    })();
  }, [dispatch, navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
        <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[36px] p-8 max-w-md text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-cyan">Authentication error</p>
          <p className="mt-4 text-base text-red-500">{error}</p>
          <a href="/auth" className="mt-6 inline-block rounded-2xl bg-ivory px-6 py-3 text-sm font-semibold text-obsidian transition hover:-translate-y-0.5">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan border-t-transparent" />
        <p className="text-sm text-slate-400">Completing authentication…</p>
      </div>
    </div>
  );
};
