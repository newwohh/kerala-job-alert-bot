import { Db, MongoClient } from "mongodb";
import { config } from "../config.js";
import { log } from "../utils/logger.js";
import { ensureAnalyticsIndexes } from "./analytics.js";
import { ensureSubscriptionIndexes } from "./subscriptions.js";
import { ensureUserNotificationIndexes } from "./userNotifications.js";

let db: Db | undefined;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  const client = new MongoClient(config.mongoUri);
  await client.connect();

  db = client.db(config.mongoDb);

  await db.collection("jobs").createIndex({ link: 1 }, { unique: true });
  await ensureAnalyticsIndexes();
  await ensureSubscriptionIndexes();
  await ensureUserNotificationIndexes();

  log("MongoDB connected");
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected");
  return db;
}
