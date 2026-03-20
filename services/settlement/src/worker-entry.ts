/**
 * Settlement worker entrypoint.
 * Start: node dist/worker-entry.js
 */
import { startWorker, scheduleDailyRun } from "./worker-impl.js";

console.log("[settlement-worker] starting...");
startWorker();
scheduleDailyRun().then(() => {
  console.log("[settlement-worker] daily scheduler registered (00:01 IST)");
});
