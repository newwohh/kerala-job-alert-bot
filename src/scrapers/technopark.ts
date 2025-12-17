import axios from "axios";
import { config } from "../config.js";
import { Job } from "../types/job.js";
import { retry } from "../utils/retry.js";

type TechnoparkApiJob = {
  id: number;
  job_title?: string;
  company?: { company?: string };
};

type TechnoparkApiResponse = {
  current_page?: number;
  last_page?: number;
  data?: TechnoparkApiJob[];
};

export async function fetchTechnopark(): Promise<Job[]> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  };

  const jobs: Job[] = [];

  for (let page = 1; page <= config.maxPages; page++) {
    const { data } = await retry(
      async () =>
        axios.get<TechnoparkApiResponse>(
          `https://technopark.in/api/paginated-jobs?page=${page}&search=&type=`,
          {
            timeout: config.requestTimeoutMs,
            headers
          }
        ),
      { retries: 2 }
    );

    const items = Array.isArray(data?.data) ? data.data : [];

    for (const item of items) {
      const id = Number(item?.id);
      const title = String(item?.job_title ?? "").trim();
      const company = String(item?.company?.company ?? "").trim() || "Unknown";
      if (!Number.isFinite(id) || !title) continue;

      jobs.push({
        title,
        company,
        source: "Technopark",
        link: `https://technopark.in/job-details/${id}`
      });
    }

    const lastPage = Number(data?.last_page ?? NaN);
    if (Number.isFinite(lastPage) && page >= lastPage) break;
  }

  return jobs;
}
