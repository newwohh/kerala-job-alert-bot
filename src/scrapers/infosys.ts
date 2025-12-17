import axios from "axios";
import { config } from "../config.js";
import { Job } from "../types/job.js";
import { retry } from "../utils/retry.js";

export async function fetchInfosys(): Promise<Job[]> {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const headers = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };

  const listingLinks = new Set<string>();

  for (let page = 1; page <= config.maxPages; page++) {
    const url = `https://digitalcareers.infosys.com/infosys/global-careers?page=${page}&per_page=25&job_type=experienced`;

    const { data } = await retry(
      async () =>
        axios.get(url, {
          timeout: config.requestTimeoutMs,
          headers
        }),
      { retries: 2 }
    );

    const html = String(data);

    const matches = html.matchAll(
      /https:\/\/digitalcareers\.infosys\.com\/global-careers\/company-job\/description\/reqid\/[A-Za-z0-9_-]+/g
    );

    for (const m of matches) listingLinks.add(m[0]);
  }

  const jobs: Job[] = [];

  for (const link of listingLinks) {
    const { data } = await retry(
      async () =>
        axios.get(link, {
          timeout: config.requestTimeoutMs,
          headers
        }),
      { retries: 2 }
    );

    const html = String(data);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = h1Match?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const title = rawTitle ? rawTitle.split(" - ")[0].trim() : "";
    if (!title) continue;

    if (config.infosysKeyword) {
      const hay = title.toLowerCase();
      const k = config.infosysKeyword.trim().toLowerCase();
      if (k && !hay.includes(k)) continue;
    }

    jobs.push({
      title,
      company: "Infosys",
      source: "Infosys",
      link
    });
  }

  return jobs;
}
