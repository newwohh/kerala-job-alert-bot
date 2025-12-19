import { getDb } from "./mongo.js";

export type Subscription = {
  chatId: number;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
};

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export async function ensureSubscriptionIndexes(): Promise<void> {
  await getDb().collection<Subscription>("subscriptions").createIndex({ chatId: 1 }, { unique: true });
}

export async function listKeywords(chatId: number): Promise<string[]> {
  const doc = await getDb().collection<Subscription>("subscriptions").findOne({ chatId });
  return Array.isArray(doc?.keywords) ? doc!.keywords : [];
}

export async function addKeyword(chatId: number, keyword: string): Promise<string[]> {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return listKeywords(chatId);

  const now = new Date();
  await getDb()
    .collection<Subscription>("subscriptions")
    .updateOne(
      { chatId },
      {
        $setOnInsert: { chatId, createdAt: now },
        $set: { updatedAt: now },
        $addToSet: { keywords: normalized }
      },
      { upsert: true }
    );

  return listKeywords(chatId);
}

export async function removeKeyword(chatId: number, keyword: string): Promise<string[]> {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return listKeywords(chatId);

  const now = new Date();
  await getDb()
    .collection<Subscription>("subscriptions")
    .updateOne(
      { chatId },
      {
        $pull: { keywords: normalized },
        $set: { updatedAt: now }
      }
    );

  return listKeywords(chatId);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  return getDb().collection<Subscription>("subscriptions").find({}).toArray();
}
