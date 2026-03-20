import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

