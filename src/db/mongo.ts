import { Db, MongoClient } from "mongodb";
import { config } from "../config.js";
import { log } from "../utils/logger.js";
import { ensureSubscriptionIndexes } from "./subscriptions.js";
import { ensureUserNotificationIndexes } from "./userNotifications.js";

let db: Db | undefined;
let client: MongoClient | undefined;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.mongoUri);
  await client.connect();

  db = client.db(config.mongoDb);

  await db.collection("jobs").createIndex({ link: 1 }, { unique: true });
  await ensureSubscriptionIndexes();
  await ensureUserNotificationIndexes();

  log("MongoDB connected");
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected");
  return db;
}

export async function disconnectMongo(): Promise<void> {
  if (!client) return;
  await client.close();
  client = undefined;
  db = undefined;
}
