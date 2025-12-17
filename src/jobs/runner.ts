import { fetchInfopark } from "../scrapers/infopark.js";
import { fetchInfosys } from "../scrapers/infosys.js";
import { fetchTechnopark } from "../scrapers/technopark.js";
import { trySave } from "../db/jobs.js";
import { post } from "../telegram/bot.js";
import { Job } from "../types/job.js";
import { config } from "../config.js";
import { notifySubscribers } from "./notify.js";
import { error, log } from "../utils/logger.js";

type Fetcher = () => Promise<Job[]>;

const sources: Array<{ name: string; fetch: Fetcher }> = [
  { name: "Infopark", fetch: fetchInfopark },
  { name: "Technopark", fetch: fetchTechnopark }
];

if (config.infosysEnabled) {
  sources.push({ name: "Infosys", fetch: fetchInfosys });
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

        await post(job);
        await notifySubscribers(job);
        postedCount++;
        log("Posted:", job.title);
      }

      log("Summary:", source.name, { posted: postedCount, duplicates: duplicateCount });
    } catch (e: any) {
      error("Fetcher failed:", source.name, e?.message ?? e);
    }
  }
}
