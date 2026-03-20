import { buildApp } from "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

const start = async () => {
  const app = await buildApp();

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });

  logger.info({
    msg: "api_started",
    port: env.PORT
  });
};

start().catch((error) => {
  logger.error({
    msg: "api_start_failed",
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});

