import { config } from "../config.js";
import { getDb } from "../db/mongo.js";
import { getUserStatsSummary, UserStatsSummary } from "../db/users.js";
import { bot } from "../telegram/bot.js";

export interface DashboardStats {
  timestamp: string;
  telegram: {
    bot: {
      id?: number;
      username?: string;
      firstName?: string;
      isPolling: boolean;
    } | null;
    channel: {
      id: string;
      title?: string;
      username?: string;
      description?: string;
      memberCount: number | null;
    } | null;
    error?: string;
  };
  users: UserStatsSummary;
  jobs: {
    total: number;
    addedLast24h: number;
    bySource: Array<{ source: string; count: number }>;
    topCompanies: Array<{ company: string; count: number }>;
    recent: Array<{
      title: string;
      company: string;
      source: string;
      link: string;
      createdAt?: string;
    }>;
  };
  subscriptions: {
    totalSubscribers: number;
    totalKeywords: number;
    topKeywords: Array<{ keyword: string; count: number }>;
  };
  notifications: {
    totalDelivered: number;
    deliveredLast24h: number;
    bySource: Array<{ source: string; count: number }>;
  };
  analytics: {
    totalEvents: number;
    uniqueUsers: number;
    starts: number;
    eventsByType: Array<{ event: string; count: number }>;
    topCommands: Array<{ command: string; count: number }>;
    topClicks: Array<{ action: string; count: number }>;
    dailyActivity: Array<{ date: string; count: number }>;
  };
  system: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    nodeVersion: string;
    memoryMb: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
    cron: {
      schedule: string;
      enabled: boolean;
    };
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 1. Telegram Data
  let botData: DashboardStats["telegram"]["bot"] = null;
  let channelData: DashboardStats["telegram"]["channel"] = null;
  let telegramError: string | undefined;

  try {
    const isPolling = typeof bot.isPolling === "function" ? bot.isPolling() : false;
    try {
      const me = await bot.getMe();
      botData = {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        isPolling
      };
    } catch (e: any) {
      telegramError = `Bot info error: ${e?.message ?? e}`;
      botData = { isPolling };
    }

    if (config.channelId) {
      try {
        const chat = await bot.getChat(config.channelId);
        let memberCount: number | null = null;
        try {
          memberCount = await bot.getChatMemberCount(config.channelId);
        } catch {
          // Channel member count might fail if bot lacks permission or channel is private
        }

        channelData = {
          id: String(config.channelId),
          title: (chat as any).title,
          username: (chat as any).username,
          description: (chat as any).description,
          memberCount
        };
      } catch (e: any) {
        channelData = {
          id: String(config.channelId),
          memberCount: null
        };
        if (!telegramError) telegramError = `Channel info error: ${e?.message ?? e}`;
      }
    }
  } catch (err: any) {
    telegramError = String(err?.message ?? err);
  }

  // 2. Database Data
  let jobsStats: DashboardStats["jobs"] = {
    total: 0,
    addedLast24h: 0,
    bySource: [],
    topCompanies: [],
    recent: []
  };

  let userStats: UserStatsSummary = {
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    totalJoins: 0,
    totalLeaves: 0,
    joined24h: 0,
    left24h: 0,
    recentEvents: []
  };

  let subStats: DashboardStats["subscriptions"] = {
    totalSubscribers: 0,
    totalKeywords: 0,
    topKeywords: []
  };

  let notifStats: DashboardStats["notifications"] = {
    totalDelivered: 0,
    deliveredLast24h: 0,
    bySource: []
  };

  let analyticsStats: DashboardStats["analytics"] = {
    totalEvents: 0,
    uniqueUsers: 0,
    starts: 0,
    eventsByType: [],
    topCommands: [],
    topClicks: [],
    dailyActivity: []
  };

  try {
    const db = getDb();

    // Jobs queries
    const jobsCol = db.collection("jobs");
    const [totalJobs, addedLast24h, jobsBySource, topCompanies, recentJobs] = await Promise.all([
      jobsCol.countDocuments(),
      jobsCol.countDocuments({ createdAt: { $gte: last24h } }),
      jobsCol
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: { $ifNull: ["$source", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray(),
      jobsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { company: { $exists: true, $ne: "" } } },
          { $group: { _id: "$company", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
        .toArray(),
      jobsCol
        .find(
          {},
          {
            projection: { title: 1, company: 1, source: 1, link: 1, createdAt: 1 }
          }
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .toArray()
    ]);

    jobsStats = {
      total: totalJobs,
      addedLast24h,
      bySource: jobsBySource.map(s => ({ source: s._id, count: s.count })),
      topCompanies: topCompanies.map(c => ({ company: c._id, count: c.count })),
      recent: recentJobs.map(j => ({
        title: (j as any).title || "Untitled",
        company: (j as any).company || "Unknown",
        source: (j as any).source || "Unknown",
        link: (j as any).link || "#",
        createdAt: (j as any).createdAt ? new Date((j as any).createdAt).toISOString() : undefined
      }))
    };

    // Subscriptions queries
    const subsCol = db.collection("subscriptions");
    const [totalSubs, topKeywordsAgg] = await Promise.all([
      subsCol.countDocuments(),
      subsCol
        .aggregate<{ _id: string; count: number }>([
          { $unwind: "$keywords" },
          { $group: { _id: "$keywords", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 15 }
        ])
        .toArray()
    ]);

    const totalKeywords = topKeywordsAgg.reduce((acc, curr) => acc + curr.count, 0);
    subStats = {
      totalSubscribers: totalSubs,
      totalKeywords,
      topKeywords: topKeywordsAgg.map(k => ({ keyword: k._id, count: k.count }))
    };

    // Notifications queries
    const notifCol = db.collection("user_notifications");
    const [totalNotifs, notifs24h, notifsBySource] = await Promise.all([
      notifCol.countDocuments(),
      notifCol.countDocuments({ createdAt: { $gte: last24h } }),
      notifCol
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: { $ifNull: ["$source", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray()
    ]);

    notifStats = {
      totalDelivered: totalNotifs,
      deliveredLast24h: notifs24h,
      bySource: notifsBySource.map(s => ({ source: s._id, count: s.count }))
    };

    // Analytics queries
    const eventsCol = db.collection("analytics_events");
    const [totalEvents, uniqueUsers, starts, eventsByType, topCommands, topClicks, dailyActivity] = await Promise.all([
      eventsCol.countDocuments(),
      eventsCol.distinct("userId", { userId: { $type: "number" } }).then(arr => arr.length).catch(() => 0),
      eventsCol.countDocuments({ event: "start" }),
      eventsCol
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$event", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray(),
      eventsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { event: "command", action: { $type: "string" } } },
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      eventsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { event: "ui_click", action: { $type: "string" } } },
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      eventsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { ts: { $gte: last14d } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ])
        .toArray()
    ]);

    userStats = await getUserStatsSummary();

    analyticsStats = {
      totalEvents,
      uniqueUsers,
      starts,
      eventsByType: eventsByType.map(e => ({ event: e._id, count: e.count })),
      topCommands: topCommands.map(c => ({ command: c._id, count: c.count })),
      topClicks: topClicks.map(c => ({ action: c._id, count: c.count })),
      dailyActivity: dailyActivity.map(d => ({ date: d._id, count: d.count }))
    };
  } catch (dbErr: any) {
    // If DB is connecting or error occurred, keep default empty stats
  }

  // 3. System Stats
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  return {
    timestamp: now.toISOString(),
    telegram: {
      bot: botData,
      channel: channelData,
      error: telegramError
    },
    users: userStats,
    jobs: jobsStats,
    subscriptions: subStats,
    notifications: notifStats,
    analytics: analyticsStats,
    system: {
      uptimeSeconds: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion: process.version,
      memoryMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024))
      },
      cron: {
        schedule: config.cron,
        enabled: config.cronEnabled
      }
    }
  };
}
