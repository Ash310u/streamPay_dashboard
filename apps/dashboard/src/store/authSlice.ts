import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { RootState } from "./index";

export type UserRole = "user" | "merchant" | "admin";

type SyncAuthSessionArg = {
  session?: Session | null;
};

type AuthSnapshot = {
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
};

type AuthState = AuthSnapshot & {
  isReady: boolean;
  error: string | null;
};

const initialState: AuthState = {
  userId: null,
  email: null,
  role: null,
  isAuthenticated: false,
  isReady: false,
  error: null,
};

export const getAppPathForRole = (role: UserRole | null) => {
  if (role === "merchant") {
    return "/app/merchant";
  }

  if (role === "admin") {
    return "/app/operator";
  }

  return "/app/customer";
};

const buildLoggedOutSnapshot = (): AuthSnapshot => ({
  userId: null,
  email: null,
  role: null,
  isAuthenticated: false,
});

export const syncAuthSession = createAsyncThunk<AuthSnapshot, SyncAuthSessionArg | void>(
  "auth/syncAuthSession",
  async (arg) => {
    const providedSession = arg && "session" in arg ? arg.session : undefined;
    const session =
      providedSession === undefined ? (await supabase.auth.getSession()).data.session : providedSession;

    if (!session?.user) {
      return buildLoggedOutSnapshot();
    }

    const profile = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    const role = (profile.data?.role ?? "user") as UserRole;

    return {
      userId: session.user.id,
      email: session.user.email ?? null,
      role,
      isAuthenticated: true,
    };
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth(state) {
      Object.assign(state, {
        ...buildLoggedOutSnapshot(),
        isReady: true,
        error: null,
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncAuthSession.pending, (state) => {
        state.error = null;
      })
      .addCase(syncAuthSession.fulfilled, (state, action) => {
        Object.assign(state, action.payload, {
          isReady: true,
          error: null,
        });
      })
      .addCase(syncAuthSession.rejected, (state, action) => {
        Object.assign(state, buildLoggedOutSnapshot(), {
          isReady: true,
          error: action.error.message ?? "Failed to sync auth session",
        });
      });
  },
});

export const { clearAuth } = authSlice.actions;

export const authReducer = authSlice.reducer;

export const selectAuth = (state: RootState) => state.auth;
export const selectAuthRole = (state: RootState) => state.auth.role;
export const selectIsAuthReady = (state: RootState) => state.auth.isReady;
