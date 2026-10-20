# 🗄️ Database Schema & Invariants

The application uses **MongoDB** as its primary persistent store. All collections, indexes, and unique constraints are initialized during startup in [`src/db/mongo.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/db/mongo.ts).

---

## 1. Collections & Data Models

### A. `jobs`
Stores all scraped job postings.
* **Primary Key / Deduplication**: `link`
* **Unique Index**: `{ link: 1 }`

```typescript
{
  _id: ObjectId("..."),
  title: "Senior Full Stack Engineer",
  company: "Mozilor Technologies Pvt. Ltd.",
  source: "Infopark",
  link: "https://infopark.in/company-jobs/details/123/456",
  createdAt: ISODate("2026-10-20T09:00:00.000Z")
}
```

---

### B. `subscriptions`
Stores user keyword alert subscriptions.
* **Unique Index**: `{ chatId: 1 }`
* **Invariant**: All keywords are normalized to lowercase and trimmed before storage.

```typescript
{
  _id: ObjectId("..."),
  chatId: 987654321,
  keywords: ["react", "node", "python", "remote"],
  createdAt: ISODate("2026-10-18T10:00:00.000Z"),
  updatedAt: ISODate("2026-10-20T08:30:00.000Z")
}
```

---

### C. `user_notifications`
Tracks which job alerts have been delivered to which users to prevent duplicate DMs.
* **Unique Compound Index**: `{ chatId: 1, link: 1 }`

```typescript
{
  _id: ObjectId("..."),
  chatId: 987654321,
  link: "https://infopark.in/company-jobs/details/123/456",
  title: "Senior Full Stack Engineer",
  company: "Mozilor Technologies Pvt. Ltd.",
  source: "Infopark",
  createdAt: ISODate("2026-10-20T09:00:05.000Z")
}
```

---

### D. `telegram_users`
Maintains user directory and engagement status across both private DMs and community groups.
* **Unique Index**: `{ userId: 1 }`
* **Index**: `{ lastActive: -1 }`

```typescript
{
  _id: ObjectId("..."),
  userId: 987654321,
  username: "rahul_dev",
  firstName: "Rahul",
  lastName: "Nair",
  isBot: false,
  source: "group_chat",       // "bot_dm" | "group_chat" | "member_event"
  status: "active",           // "active" | "blocked" | "left"
  firstSeen: ISODate("2026-10-15T12:00:00.000Z"),
  lastActive: ISODate("2026-10-20T09:20:00.000Z")
}
```

---

### E. `member_events`
Audit log of community join, leave, block, and unblock events.
* **Indexes**: `{ createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`

```typescript
{
  _id: ObjectId("..."),
  chatId: -1003554590747,
  userId: 987654321,
  username: "rahul_dev",
  firstName: "Rahul",
  lastName: "Nair",
  action: "joined",           // "joined" | "left" | "blocked" | "unblocked"
  inviteLink: "https://t.me/+DwPruraqrH4xNDQ9",
  createdAt: ISODate("2026-10-20T09:15:00.000Z")
}
```

---

### F. `analytics_events`
Logs bot commands, button clicks, and search queries for behavioral metrics.
* **Indexes**: `{ ts: -1 }`, `{ event: 1, ts: -1 }`, `{ userId: 1, ts: -1 }`, `{ action: 1, ts: -1 }`

```typescript
{
  _id: ObjectId("..."),
  ts: ISODate("2026-10-20T09:25:00.000Z"),
  event: "command",           // "command" | "ui_click" | "search" | "start"
  action: "/search",
  userId: 987654321,
  chatId: 987654321,
  chatType: "private",
  meta: {
    keywordLength: 5
  }
}
```

---

## 2. Idempotency & Error Code 11000

To guarantee that duplicate jobs or duplicate alerts are never processed:
1. Operations perform `insertOne(...)` directly on collections with unique indexes.
2. If a duplicate exists, MongoDB throws a `MongoServerError` with error code `11000`.
3. The application intercepts `code === 11000` and returns `false`, ensuring zero duplicate channel posts or DM spam:

```typescript
try {
  await db.collection("jobs").insertOne({ ...job, createdAt: new Date() });
  return true; // Successfully saved new job
} catch (e: unknown) {
  if (e instanceof MongoServerError && e.code === 11000) {
    return false; // Already exists, safe to ignore
  }
  throw e;
}
```
