
import cron from "node-cron";
import { createServer } from "node:http";
import { config } from "./config.js";
import { connectMongo } from "./db/mongo.js";
import { postAnalyticsSummary } from "./analytics/report.js";
import { runJobs } from "./jobs/runner.js";
import { registerCommandHandlers } from "./telegram/commands.js";
import { registerOnboardingHandlers } from "./telegram/onboarding.js";
import { bot, startBotPolling } from "./telegram/bot.js";
import { log } from "./utils/logger.js";

function startHealthServer(): void {
  const portRaw = process.env.PORT;
  if (!portRaw) return;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return;

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url.startsWith("/healthz")) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, "0.0.0.0", () => {
    log("Health server listening on:", String(port));
  });
}

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
    cron.schedule(config.cron, runJobs);
    log("Cron enabled:", config.cron);
  } else {
    log("Cron disabled: no automatic job posting");
  }

  if (config.analyticsEnabled) {
    const reportChatId = config.analyticsChatId || config.channelId;
    cron.schedule(config.analyticsCron, async () => {
      const since = new Date(Date.now() - config.analyticsWindowHours * 60 * 60 * 1000);
      await postAnalyticsSummary(bot, reportChatId, since);
    });
    log("Analytics enabled:", config.analyticsCron);
  }
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
