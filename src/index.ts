
import cron from "node-cron";
import { config } from "./config.js";
import { connectMongo } from "./db/mongo.js";
import { runJobs } from "./jobs/runner.js";
import { registerCommandHandlers } from "./telegram/commands.js";
import { registerOnboardingHandlers } from "./telegram/onboarding.js";
import { bot } from "./telegram/bot.js";
import { log } from "./utils/logger.js";

async function start(): Promise<void> {
  await connectMongo();
  // logs starting
  log("Job Alert Bot running");


  registerCommandHandlers(bot);
  registerOnboardingHandlers(bot);

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
    cron.schedule(config.cron, runJobs);
    log("Cron enabled:", config.cron);
  } else {
    log("Cron disabled: no automatic job posting");
  }
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
