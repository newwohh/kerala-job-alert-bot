# 🕷️ Scrapers & Scraping Pipeline

This document describes how job scrapers are implemented, how pagination and retries work, and how to add new IT park sources to the system.

---

## 1. Supported Scraper Sources

The bot currently scrapes from Kerala's two largest tech parks:

| Source | File | Target URL | Method |
| :--- | :--- | :--- | :--- |
| **Infopark** | [`src/scrapers/infopark.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/scrapers/infopark.ts) | `https://infopark.in/company-jobs` | HTML Scraping via Cheerio |
| **Technopark** | [`src/scrapers/technopark.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/scrapers/technopark.ts) | `https://technopark.org/api/paginated-jobs` | JSON API with Axios |

---

## 2. Scraper Contract

Every scraper module exports a function adhering to this contract:

```ts
import { Job } from "../types/job.js";

export async function scrapeSource(): Promise<Job[]> {
  // 1. Fetch pages up to config.maxPages
  // 2. Extract title, company, source, and canonical link
  // 3. Return normalized Job[]
}
```

### The `Job` Data Model
```ts
export type Job = {
  title: string;    // e.g. "Senior React Developer"
  company: string;  // e.g. "2Base Technologies Pvt Ltd"
  source: string;   // e.g. "Infopark"
  link: string;     // Canonical URL to apply (Primary Key)
};
```

---

## 3. Resilience & Pagination Rules

1. **Maximum Page Limit**: Scrapers must respect `config.maxPages` (default `3`) to avoid overloading target websites during frequent cron cycles.
2. **Early Termination**: If a page returns 0 jobs or indicates it is the last page, the loop must break immediately.
3. **HTTP Timeouts**: All requests must pass `timeout: config.requestTimeoutMs` (default `15000` ms).
4. **Retry Mechanism**: Wrapped with [`retry()`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/utils/retry.ts) using exponential backoff to handle transient network blips.

---

## 4. How to Add a New Scraper

Follow these steps to add a new job portal (e.g. Cyberpark Kozhikode):

### Step 1: Create Scraper Module
Create `src/scrapers/cyberpark.ts`:

```ts
import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../config.js";
import { Job } from "../types/job.js";
import { retry } from "../utils/retry.js";
import { error, log } from "../utils/logger.js";

export async function scrapeCyberpark(): Promise<Job[]> {
  const jobs: Job[] = [];

  for (let page = 1; page <= config.maxPages; page++) {
    try {
      const url = `https://www.cyberparkkerala.org/careers?page=${page}`;
      const res = await retry(() => axios.get(url, { timeout: config.requestTimeoutMs }));
      const $ = cheerio.load(res.data);

      const items = $(".job-listing-item");
      if (items.length === 0) break; // End of pages

      items.each((_, el) => {
        const title = $(el).find(".job-title").text().trim();
        const company = $(el).find(".company-name").text().trim();
        const link = $(el).find("a.apply-link").attr("href")?.trim();

        if (title && link) {
          jobs.push({
            title,
            company: company || "Cyberpark Company",
            source: "Cyberpark",
            link: new URL(link, "https://www.cyberparkkerala.org").toString()
          });
        }
      });
    } catch (err) {
      error(`Failed to scrape Cyberpark page ${page}:`, err);
      break;
    }
  }

  log(`Scraped ${jobs.length} jobs from Cyberpark`);
  return jobs;
}
```

### Step 2: Register in Scraper Runner
Open [`src/jobs/runner.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/jobs/runner.ts) and add the new scraper to the `scrapers` list:

```ts
import { scrapeInfopark } from "../scrapers/infopark.js";
import { scrapeTechnopark } from "../scrapers/technopark.js";
import { scrapeCyberpark } from "../scrapers/cyberpark.js"; // <-- Add this

const scrapers = [
  scrapeInfopark,
  scrapeTechnopark,
  scrapeCyberpark // <-- Add this
];
```

The runner will now automatically scrape Cyberpark on every cron run, deduplicate postings, publish new jobs to the channel, and trigger subscriber keyword alerts!
