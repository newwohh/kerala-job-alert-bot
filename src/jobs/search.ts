import { config } from "../config.js";
import { Job } from "../types/job.js";
import { fetchInfopark } from "../scrapers/infopark.js";
import { fetchTechnopark } from "../scrapers/technopark.js";
import { fetchInfosys } from "../scrapers/infosys.js";
import { matchesKeyword } from "../utils/match.js";

export async function searchJobs(keyword: string): Promise<Job[]> {
  const sources: Array<() => Promise<Job[]>> = [fetchInfopark, fetchTechnopark];
  if (config.infosysEnabled) sources.push(fetchInfosys);

  const all: Job[] = [];
  for (const fetcher of sources) {
    const jobs = await fetcher();
    all.push(...jobs);
  }

  const normalized = keyword.trim();
  return all.filter(j => matchesKeyword(j, normalized));
}
