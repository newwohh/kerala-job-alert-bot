import { MongoServerError } from "mongodb";
import { Job } from "../types/job.js";
import { getDb } from "./mongo.js";

export async function trySave(job: Job): Promise<boolean> {
  try {
    await getDb()
      .collection<Job & { createdAt: Date }>("jobs")
      .insertOne({ ...job, createdAt: new Date() });
    return true;
  } catch (e: unknown) {
    if (e instanceof MongoServerError && e.code === 11000) return false;
    throw e;
  }
}
