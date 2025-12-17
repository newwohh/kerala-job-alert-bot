import { Job } from "../types/job.js";

export function matchesKeyword(job: Job, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  const haystack = `${job.title} ${job.company} ${job.source}`.toLowerCase();
  return haystack.includes(k);
}

export function matchesAnyKeyword(job: Job, keywords: string[]): boolean {
  return keywords.some(k => matchesKeyword(job, k));
}
