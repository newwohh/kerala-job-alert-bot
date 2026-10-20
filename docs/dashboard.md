# 📊 Live Analytics & Community Dashboard

The Kerala Job Alert Bot features a built-in, real-time web dashboard that aggregates data from the **Telegram Bot API**, **MongoDB**, and **Node.js runtime telemetry**.

The dashboard is served directly by the bot's internal HTTP server on `PORT` (default `8080`) without requiring an extra frontend web server or build step.

---

## 1. HTTP Endpoints

| Route | Method | Content-Type | Purpose |
| :--- | :---: | :--- | :--- |
| `/` or `/dashboard` | `GET` | `text/html` | Full interactive dark-mode analytics dashboard UI |
| `/api/stats` | `GET` | `application/json` | Raw JSON telemetry payload (used by client-side auto-refresh) |
| `/healthz` | `GET` | `text/plain` | Cloud health probe check (strictly returns HTTP 200 `ok`) |

---

## 2. Dashboard Components & Visualizations

### A. Real-Time KPI Cards
1. **Community Audience**: Current live member count from the Telegram API (`getChatMemberCount`).
2. **Tracked Users**: Total registered Telegram users in MongoDB, with "+X in 24h" join delta.
3. **Scraped Jobs**: Total indexed jobs across tech parks, with "+X in 24h" new jobs badge.
4. **Alert Subscribers**: Active job seekers with customized alert keywords.
5. **DM Alerts Sent**: Personalized job alerts successfully matched and delivered to user private chats.

### B. Interactive Charts (Chart.js)
* **User Activity Timeline (14 Days)**: Smooth area chart depicting daily interactions (commands, searches, button taps).
* **Jobs by Source**: Doughnut breakdown highlighting the distribution between Infopark, Technopark, and other sources.
* **Top Alert Keywords**: Horizontal bar chart showing the most requested developer skills (e.g. React, Python, Flutter, Node).
* **Commands & UI Clicks**: Bar chart measuring feature usage (`/search`, `/subscribe`, `/onboard`, button clicks).

### C. Live Data Feeds & Tables
* **Latest Scraped Jobs**: Shows the 10 most recent job postings with tech park tags, company names, and direct "Apply" links.
* **Top Hiring Companies**: Ordered ranking of companies with the highest number of active openings.
* **Community & Member Activity Feed**: Live event feed tracking user joins, leaves, and unblock events with timestamps and invite link attribution.
* **System Telemetry**: Displays bot `@username`, target chat ID, active cron schedule, Node.js version, and memory consumption (RSS / Heap).

---

## 3. Client-Side Auto-Refresh

The web page includes a zero-dependency client script that:
1. Polls `/api/stats` automatically every **30 seconds** (toggleable via the UI checkbox).
2. Updates KPI values, tables, and Chart.js datasets dynamically in-place without reloading the page.
3. Includes a **Refresh** button with loading animation for manual on-demand data retrieval.

---

## 4. JSON API Response Specification

Making a `GET` request to `/api/stats` returns the complete state tree:

```json
{
  "timestamp": "2026-10-20T09:27:59.843Z",
  "telegram": {
    "bot": {
      "id": 8328652471,
      "username": "KeralaJobAlertBOT",
      "firstName": "Kerala Careers Hub",
      "isPolling": true
    },
    "channel": {
      "id": "@joinkeralajobsalerts",
      "title": "Kerala Daily Job Alerts Chat",
      "username": "joinkeralajobsalerts",
      "memberCount": 75
    }
  },
  "users": {
    "totalUsers": 142,
    "activeUsers": 139,
    "blockedUsers": 3,
    "totalJoins": 48,
    "totalLeaves": 5,
    "joined24h": 6,
    "left24h": 1,
    "recentEvents": [
      {
        "userId": 12345678,
        "username": "dev_rahul",
        "firstName": "Rahul",
        "action": "joined",
        "inviteLink": "https://t.me/+DwPruraqrH4xNDQ9",
        "createdAt": "2026-10-20T09:15:00.000Z"
      }
    ]
  },
  "jobs": {
    "total": 449,
    "addedLast24h": 56,
    "bySource": [
      { "source": "Technopark", "count": 228 },
      { "source": "Infopark", "count": 221 }
    ],
    "topCompanies": [
      { "company": "Way Dot Com (P) Ltd", "count": 53 },
      { "company": "Mozilor Technologies Pvt. Ltd.", "count": 51 }
    ],
    "recent": [
      {
        "title": "WordPress Developer",
        "company": "Jachoos Technologies Private Limited",
        "source": "Infopark",
        "link": "https://infopark.in/company-jobs/details/363/26268",
        "createdAt": "2026-10-20T09:00:03.821Z"
      }
    ]
  },
  "subscriptions": {
    "totalSubscribers": 28,
    "totalKeywords": 74,
    "topKeywords": [
      { "keyword": "react", "count": 14 },
      { "keyword": "python", "count": 11 }
    ]
  },
  "notifications": {
    "totalDelivered": 185,
    "deliveredLast24h": 32,
    "bySource": [
      { "source": "Infopark", "count": 98 },
      { "source": "Technopark", "count": 87 }
    ]
  },
  "system": {
    "uptimeSeconds": 1420,
    "uptimeFormatted": "23m 40s",
    "nodeVersion": "v22.14.0",
    "memoryMb": {
      "rss": 131,
      "heapUsed": 44,
      "heapTotal": 67
    },
    "cron": {
      "schedule": "*/20 * * * *",
      "enabled": true
    }
  }
}
```
