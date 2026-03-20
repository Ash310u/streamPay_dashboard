import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "./api-error.js";
import type { AppRole } from "@detrix/shared-types";

export const requireAuth = (request: FastifyRequest) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  return request.user;
};

export const requireRole = (request: FastifyRequest, roles: AppRole[]) => {
  const user = requireAuth(request);

  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  return user;
};

export const sendApiError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      details: error.details
    });
  }

  throw error;
};

