
import cron from "node-cron";
import { config } from "./config.js";
import { connectMongo } from "./db/mongo.js";
import { postAnalyticsSummary } from "./analytics/report.js";
import { runJobs } from "./jobs/runner.js";
import { registerCommandHandlers } from "./telegram/commands.js";
import { registerOnboardingHandlers } from "./telegram/onboarding.js";
import { bot, startBotPolling } from "./telegram/bot.js";
import { error, log } from "./utils/logger.js";
import { startHealthServer } from "./utils/health-server.js";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler.js";

// handle uncaught exceptions and unhandled 
// promise rejections to prevent silent crashes
setupGlobalErrorHandlers();

async function start(): Promise<void> {
  startHealthServer();
  await connectMongo();
  // logs starting message
  log("Job Alert Bot running");


  registerCommandHandlers(bot);
  registerOnboardingHandlers(bot);
  await startBotPolling();

  if (config.onboardingChatId) {
    const me = await bot.getMe();
    const deepLink = me.username ? `https://t.me/${me.username}?start=onboard` : "";
    const msg =
      "<b>Job Alerts Bot is online</b>\n\n" +
      "Type /start in this group to choose your job keywords.\n" +
      (deepLink
        ? `For DM alerts, open the bot privately once:\n<a href=\"${deepLink}\">Start bot</a>`
        : "For DM alerts, open the bot in private chat and press Start once.");

    await bot.sendMessage(config.onboardingChatId, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }

  if (config.runJobsOnStartup) {
    await runJobs();
  }

  if (config.cronEnabled) {
    cron.schedule(config.cron, () => {
      void runJobs().catch(e => error("Scheduled job run failed:", e));
    });
    log("Cron enabled:", config.cron);
  } else {
    log("Cron disabled: no automatic job posting");
  }

  if (config.analyticsEnabled) {
    const reportChatId = config.analyticsChatId || config.channelId;
    cron.schedule(config.analyticsCron, () => {
      const since = new Date(Date.now() - config.analyticsWindowHours * 60 * 60 * 1000);
      void postAnalyticsSummary(bot, reportChatId, since).catch(e => error("Analytics job failed:", e));
    });
    log("Analytics enabled:", config.analyticsCron);
  }
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
