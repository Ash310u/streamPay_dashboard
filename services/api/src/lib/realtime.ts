import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { authClient } from "./supabase-auth.js";

export const USER_ROOM_PREFIX = "user:";
export const MERCHANT_ROOM_PREFIX = "merchant:";
export const OPERATOR_ROOM = "operator";

export const createRealtimeServer = (app: FastifyInstance) => {
  const io = new Server(app.server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return next(new Error("Unauthorized"));
    }

    const { data: profile } = await app.supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    socket.data.userId = data.user.id;
    socket.data.role = profile?.role ?? "user";
    socket.join(`${USER_ROOM_PREFIX}${data.user.id}`);

    if (profile?.role === "merchant") {
      socket.join(`${MERCHANT_ROOM_PREFIX}${data.user.id}`);
    }

    if (profile?.role === "admin") {
      socket.join(OPERATOR_ROOM);
    }

    next();
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:merchant", (merchantId: string) => {
      if (socket.data.role === "merchant" && socket.data.userId === merchantId) {
        socket.join(`${MERCHANT_ROOM_PREFIX}${merchantId}`);
      }
    });

    socket.on("subscribe:operator", () => {
      if (socket.data.role === "admin") {
        socket.join(OPERATOR_ROOM);
      }
    });
  });

  return io;
};

export class RealtimeEmitter {
  constructor(private readonly app: FastifyInstance) {}

  emitToUser(userId: string, event: string, payload: unknown) {
    this.app.io.to(`${USER_ROOM_PREFIX}${userId}`).emit(event, payload);
  }

  emitToMerchant(merchantId: string, event: string, payload: unknown) {
    this.app.io.to(`${MERCHANT_ROOM_PREFIX}${merchantId}`).emit(event, payload);
  }

  emitToOperator(event: string, payload: unknown) {
    this.app.io.to(OPERATOR_ROOM).emit(event, payload);
  }
}
