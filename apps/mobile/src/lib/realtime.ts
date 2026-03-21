/**
 * Mobile realtime client with automatic reconnect + exponential backoff.
 * Falls back to polling when WebSocket is unavailable.
 */
import { io, type Socket } from "socket.io-client";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "./supabase";

const API_WS_URL = process.env.EXPO_PUBLIC_API_WS_URL ?? process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30_000;

export const createMobileRealtime = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  socket = io(API_WS_URL, {
    auth: {
      token
    },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: MAX_RECONNECT_DELAY,
    timeout: 10_000,
    forceNew: false
  });

  socket.on("connect", () => {
    reconnectAttempts = 0;
    console.log("[realtime] connected", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[realtime] disconnected:", reason);

    // If server-side disconnect, force reconnect
    if (reason === "io server disconnect") {
      socket?.connect();
    }
  });

  socket.on("connect_error", (err) => {
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    console.warn(`[realtime] connection error (attempt ${reconnectAttempts}), retry in ${delay}ms:`, err.message);
  });

  // Reconnect when app returns to foreground
  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === "active" && socket && !socket.connected) {
      console.log("[realtime] app foregrounded — reconnecting");
      socket.connect();
    }
  };

  AppState.addEventListener("change", handleAppStateChange);

  return socket;
};

/** Disconnect the realtime socket (e.g., on logout) */
export const disconnectRealtime = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }
};
