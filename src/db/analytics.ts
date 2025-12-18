import { getDb } from "./mongo.js";

export type AnalyticsEvent = {
  ts: Date;
  event: string;
  action?: string;
  userId?: number;
  chatId?: number;
  chatType?: string;
  meta?: Record<string, unknown>;
};

export type AnalyticsSummary = {
  since: Date;
  totalEvents: number;
  uniqueUsers: number;
  starts: number;
  byEvent: Array<{ event: string; count: number }>;
  commands: Array<{ command: string; count: number }>;
  clicks: Array<{ action: string; count: number }>;
};

export async function ensureAnalyticsIndexes(): Promise<void> {
  const col = getDb().collection<AnalyticsEvent>("analytics_events");
  await col.createIndex({ ts: -1 });
  await col.createIndex({ event: 1, ts: -1 });
  await col.createIndex({ userId: 1, ts: -1 });
  await col.createIndex({ action: 1, ts: -1 });
}

export async function trackEvent(event: Omit<AnalyticsEvent, "ts">): Promise<void> {
  await getDb().collection<AnalyticsEvent>("analytics_events").insertOne({
    ts: new Date(),
    ...event
  });
}

export async function getAnalyticsSummary(since: Date): Promise<AnalyticsSummary> {
  const col = getDb().collection<AnalyticsEvent>("analytics_events");

  const result = await col
    .aggregate<{ summary: AnalyticsSummary }>([
      { $match: { ts: { $gte: since } } },
      {
        $facet: {
          totalEvents: [{ $count: "count" }],
          uniqueUsers: [
            { $match: { userId: { $type: "number" } } },
            { $group: { _id: "$userId" } },
            { $count: "count" }
          ],
          starts: [
            { $match: { event: "start", userId: { $type: "number" } } },
            { $group: { _id: "$userId" } },
            { $count: "count" }
          ],
          byEvent: [
            { $group: { _id: "$event", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          commands: [
            { $match: { event: "command", action: { $type: "string" } } },
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          clicks: [
            { $match: { event: "ui_click", action: { $type: "string" } } },
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        }
      },
      {
        $project: {
          summary: {
            since: { $literal: since },
            totalEvents: { $ifNull: [{ $first: "$totalEvents.count" }, 0] },
            uniqueUsers: { $ifNull: [{ $first: "$uniqueUsers.count" }, 0] },
            starts: { $ifNull: [{ $first: "$starts.count" }, 0] },
            byEvent: {
              $map: {
                input: "$byEvent",
                as: "e",
                in: { event: "$$e._id", count: "$$e.count" }
              }
            },
            commands: {
              $map: {
                input: "$commands",
                as: "c",
                in: { command: "$$c._id", count: "$$c.count" }
              }
            },
            clicks: {
              $map: {
                input: "$clicks",
                as: "c",
                in: { action: "$$c._id", count: "$$c.count" }
              }
            }
          }
        }
      }
    ])
    .toArray();

  return (
    result[0]?.summary ?? {
      since,
      totalEvents: 0,
      uniqueUsers: 0,
      starts: 0,
      byEvent: [],
      commands: [],
      clicks: []
    }
  );
}
