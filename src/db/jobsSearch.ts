import { Filter } from "mongodb";
import { Job } from "../types/job.js";
import { getDb } from "./mongo.js";

type JobDoc = Job & { createdAt?: Date };

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchJobsByKeyword(keyword: string, limit: number): Promise<Job[]> {
  const k = keyword.trim();
  if (!k) return [];

  const rx = new RegExp(escapeRegex(k), "i");
  const filter: Filter<JobDoc> = {
    $or: [{ title: rx }, { company: rx }, { source: rx }]
  };

  const docs = await getDb()
    .collection<JobDoc>("jobs")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, limit))
    .toArray();

  return docs.map(d => ({ title: d.title, company: d.company, source: d.source, link: d.link }));
}

export async function findRecentJobsByKeywords(keywords: string[], limit: number): Promise<Job[]> {
  const normalized = keywords.map(k => k.trim()).filter(Boolean);
  if (normalized.length === 0) return [];

  const orFilters: Filter<JobDoc>[] = [];
  for (const k of normalized) {
    const rx = new RegExp(escapeRegex(k), "i");
    orFilters.push({ title: rx }, { company: rx }, { source: rx });
  }

  const filter: Filter<JobDoc> = { $or: orFilters };

  const docs = await getDb()
    .collection<JobDoc>("jobs")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, limit))
    .toArray();

  return docs.map(d => ({ title: d.title, company: d.company, source: d.source, link: d.link }));
}
