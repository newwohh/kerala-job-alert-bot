
import cron from "node-cron";
import { config } from "./config.js";
import { connectMongo } from "./db/mongo.js";
import { runJobs } from "./jobs/runner.js";
import { registerCommandHandlers } from "./telegram/commands.js";
import { bot } from "./telegram/bot.js";
import { log } from "./utils/logger.js";

async function start(): Promise<void> {
  await connectMongo();
  log("Job Alert Bot running");

  registerCommandHandlers(bot);

  await runJobs();
  cron.schedule(config.cron, runJobs);
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
