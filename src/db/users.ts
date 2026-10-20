import { getDb } from "./mongo.js";

export type TelegramUser = {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isBot: boolean;
  firstSeen: Date;
  lastActive: Date;
  source: string;
  status: "active" | "blocked" | "left";
};

export type MemberEvent = {
  chatId: number | string;
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  action: "joined" | "left" | "blocked" | "unblocked";
  inviteLink?: string;
  createdAt: Date;
};

export async function ensureUserIndexes(): Promise<void> {
  const db = getDb();
  await db.collection<TelegramUser>("telegram_users").createIndex({ userId: 1 }, { unique: true });
  await db.collection<TelegramUser>("telegram_users").createIndex({ lastActive: -1 });
  await db.collection<MemberEvent>("member_events").createIndex({ createdAt: -1 });
  await db.collection<MemberEvent>("member_events").createIndex({ userId: 1, createdAt: -1 });
  await db.collection<MemberEvent>("member_events").createIndex({ action: 1, createdAt: -1 });
}

export async function recordUser(
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
  },
  source = "general",
  status?: "active" | "blocked" | "left"
): Promise<void> {
  if (!user?.id) return;
  const now = new Date();

  const setPayload: Record<string, any> = {
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    isBot: Boolean(user.is_bot),
    lastActive: now
  };
  if (status) {
    setPayload.status = status;
  }

  await getDb()
    .collection<TelegramUser>("telegram_users")
    .updateOne(
      { userId: user.id },
      {
        $setOnInsert: {
          userId: user.id,
          firstSeen: now,
          source,
          status: status || "active"
        },
        $set: setPayload
      },
      { upsert: true }
    );
}

export async function recordMemberEvent(event: {
  chatId: number | string;
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  action: "joined" | "left" | "blocked" | "unblocked";
  inviteLink?: string;
}): Promise<void> {
  const now = new Date();

  // 1. Record the timeline event
  await getDb().collection<MemberEvent>("member_events").insertOne({
    chatId: event.chatId,
    userId: event.user.id,
    username: event.user.username,
    firstName: event.user.first_name,
    lastName: event.user.last_name,
    action: event.action,
    inviteLink: event.inviteLink,
    createdAt: now
  });

  // 2. Update user status in telegram_users
  const userStatus =
    event.action === "joined" || event.action === "unblocked"
      ? "active"
      : event.action === "blocked"
      ? "blocked"
      : "left";

  await recordUser(event.user, "member_event", userStatus);
}

export interface UserStatsSummary {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalJoins: number;
  totalLeaves: number;
  joined24h: number;
  left24h: number;
  recentEvents: Array<{
    userId: number;
    username?: string;
    firstName?: string;
    action: string;
    inviteLink?: string;
    createdAt: string;
  }>;
}

export async function getUserStatsSummary(): Promise<UserStatsSummary> {
  const db = getDb();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    totalJoins,
    totalLeaves,
    joined24h,
    left24h,
    recentEvents
  ] = await Promise.all([
    db.collection("telegram_users").countDocuments(),
    db.collection("telegram_users").countDocuments({ status: "active" }),
    db.collection("telegram_users").countDocuments({ status: "blocked" }),
    db.collection("member_events").countDocuments({ action: "joined" }),
    db.collection("member_events").countDocuments({ action: "left" }),
    db.collection("member_events").countDocuments({ action: "joined", createdAt: { $gte: last24h } }),
    db.collection("member_events").countDocuments({ action: "left", createdAt: { $gte: last24h } }),
    db.collection("member_events")
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
  ]);

  return {
    totalUsers,
    activeUsers,
    blockedUsers,
    totalJoins,
    totalLeaves,
    joined24h,
    left24h,
    recentEvents: recentEvents.map(e => ({
      userId: (e as any).userId,
      username: (e as any).username,
      firstName: (e as any).firstName,
      action: (e as any).action,
      inviteLink: (e as any).inviteLink,
      createdAt: (e as any).createdAt ? new Date((e as any).createdAt).toISOString() : new Date().toISOString()
    }))
  };
}
