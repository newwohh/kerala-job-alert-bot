
import { connectMongo } from "./db/mongo.js";
import { postOnboardingAnnouncement } from "./startup/announcement.js";
import { runStartupJobs, scheduleRecurringTasks } from "./startup/scheduler.js";
import { registerCommandHandlers } from "./telegram/commands.js";
import { registerOnboardingHandlers } from "./telegram/onboarding.js";
import { bot, startBotPolling } from "./telegram/bot.js";
import { error, log } from "./utils/logger.js";
import { startHealthServer } from "./utils/health-server.js";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler.js";

setupGlobalErrorHandlers();

async function start(): Promise<void> {
  // 1. Start the optional HTTP endpoint used by hosting platforms.
  startHealthServer();

  // 2. Connect before any feature tries to read or write MongoDB.
  await connectMongo();
  log("Job Alert Bot running");

  // 3. Register Telegram behavior before polling for new updates.
  registerCommandHandlers(bot);
  registerOnboardingHandlers(bot);
  await startBotPolling();

  // 4. Run optional startup tasks.
  await postOnboardingAnnouncement();
  await runStartupJobs();

  // 5. Schedule recurring work.
  scheduleRecurringTasks();
}

void start().catch(err => {
  error("Fatal error:", err);
  process.exit(1);
});
