import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

export const createRealtimeClient = async (): Promise<Socket> => {
  const token = await getAccessToken();

  return io(import.meta.env.VITE_API_URL, {
    auth: {
      token
    },
    transports: ["websocket", "polling"]
  });
};
