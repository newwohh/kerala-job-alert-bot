import { MongoServerError } from "mongodb";
import { Job } from "../types/job.js";
import { getDb } from "./mongo.js";

export type UserNotification = {
  chatId: number;
  link: string;
  createdAt: Date;
  source: string;
  title: string;
  company: string;
};

export async function ensureUserNotificationIndexes(): Promise<void> {
  await getDb()
    .collection<UserNotification>("user_notifications")
    .createIndex({ chatId: 1, link: 1 }, { unique: true });
}

export async function tryMarkNotified(chatId: number, job: Job): Promise<boolean> {
  try {
    await getDb().collection<UserNotification>("user_notifications").insertOne({
      chatId,
      link: job.link,
      createdAt: new Date(),
      source: job.source,
      title: job.title,
      company: job.company
    });
    return true;
  } catch (e: unknown) {
    if (e instanceof MongoServerError && e.code === 11000) return false;
    throw e;
  }
}

export async function unmarkNotified(chatId: number, link: string): Promise<void> {
  await getDb().collection<UserNotification>("user_notifications").deleteOne({ chatId, link });
}
