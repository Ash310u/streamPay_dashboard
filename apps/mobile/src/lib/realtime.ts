import { io, type Socket } from "socket.io-client";
import { supabase } from "./supabase";

export const createMobileRealtime = async (): Promise<Socket> => {
  const session = await supabase.auth.getSession();
  return io(process.env.EXPO_PUBLIC_API_URL ?? "", {
    auth: {
      token: session.data.session?.access_token
    },
    transports: ["websocket", "polling"]
  });
};

