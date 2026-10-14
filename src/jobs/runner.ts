import { fetchInfopark } from "../scrapers/infopark.js";
import { fetchTechnopark } from "../scrapers/technopark.js";
import { removeJob, trySave } from "../db/jobs.js";
import { post } from "../telegram/bot.js";
import { Job } from "../types/job.js";
import { notifySubscribers } from "./notify.js";
import { error, log } from "../utils/logger.js";

type Fetcher = () => Promise<Job[]>;

const sources: Array<{ name: string; fetch: Fetcher }> = [
  { name: "Infopark", fetch: fetchInfopark },
  { name: "Technopark", fetch: fetchTechnopark }
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runJobs(): Promise<void> {
  for (const source of sources) {
    try {
      const jobs = await source.fetch();
      log("Fetched:", source.name, jobs.length);

      let postedCount = 0;
      let duplicateCount = 0;

      for (const job of jobs) {
        const saved = await trySave(job);
        if (!saved) {
          duplicateCount++;
          continue;
        }

        try {
          await post(job);
          await notifySubscribers(job);
          postedCount++;
          log("Posted:", job.title);
        } catch (err: any) {
          const retryAfter = err?.response?.parameters?.retry_after ?? err?.parameters?.retry_after;
          if (retryAfter) {
            log(`Rate limited by Telegram. Waiting ${retryAfter}s before retrying...`);
            await sleep((retryAfter + 1) * 1000);
            try {
              await post(job);
              await notifySubscribers(job);
              postedCount++;
              log("Posted (after retry):", job.title);
            } catch (retryErr) {
              error("Failed to post after 429 wait:", job.title, retryErr);
              await removeJob(job.link);
            }
          } else {
            error("Failed to post job:", job.title, err?.message ?? err);
            await removeJob(job.link);
          }
        }

        // Throttle to respect Telegram rate limits (1 msg per 1.5s)
        await sleep(1500);
      }

      log("Summary:", source.name, { posted: postedCount, duplicates: duplicateCount });
    } catch (e: any) {
      error("Fetcher failed:", source.name, e?.message ?? e);
    }
  }
}

