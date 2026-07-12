import cron from "node-cron";
import { postAnalyticsSummary } from "../analytics/report.js";
import { config } from "../config.js";
import { runJobs } from "../jobs/runner.js";
import { bot } from "../telegram/bot.js";
import { error, log } from "../utils/logger.js";

export async function runStartupJobs(): Promise<void> {
  if (!config.runJobsOnStartup) return;

  log("Running jobs on startup");
  await runJobs();
}

export function scheduleRecurringTasks(): void {
  scheduleJobRuns();
  scheduleAnalyticsReports();
}

function scheduleJobRuns(): void {
  if (!config.cronEnabled) {
    log("Cron disabled: no automatic job posting");
    return;
  }

  cron.schedule(config.cron, () => {
    void runJobs().catch(err => error("Scheduled job run failed:", err));
  });

  log("Cron enabled:", config.cron);
}

function scheduleAnalyticsReports(): void {
  if (!config.analyticsEnabled) return;

  const reportChatId = config.analyticsChatId || config.channelId;
  cron.schedule(config.analyticsCron, () => {
    const since = new Date(Date.now() - config.analyticsWindowHours * 60 * 60 * 1000);
    void postAnalyticsSummary(bot, reportChatId, since).catch(err => error("Analytics job failed:", err));
  });

  log("Analytics enabled:", config.analyticsCron);
}
