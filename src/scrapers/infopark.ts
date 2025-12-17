import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../config.js";
import { Job } from "../types/job.js";
import { retry } from "../utils/retry.js";

export async function fetchInfopark(): Promise<Job[]> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };

  const jobs: Job[] = [];

  for (let page = 1; page <= config.maxPages; page++) {
    const url =
      page === 1
        ? "https://infopark.in/companies/job-search"
        : `https://infopark.in/companies/job-search?page=${page}`;

    const { data } = await retry(
      async () =>
        axios.get(url, {
          timeout: config.requestTimeoutMs,
          headers
        }),
      { retries: 2 }
    );

    const $ = cheerio.load(data);

    const rows = $("#job-list tbody tr").toArray();
    for (const row of rows) {
      const tds = $(row).find("td").toArray();
      const title = String($(tds[1]).text() ?? "").trim();
      const company = String($(tds[2]).text() ?? "").trim();
      const href = $(row).find("a[href]").attr("href");

      if (!title || !company || !href) continue;
      const link = href.startsWith("http") ? href : `https://infopark.in${href}`;

      jobs.push({
        title,
        company,
        source: "Infopark",
        link
      });
    }
  }

  return jobs;
}
