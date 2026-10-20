# 🚀 Production Deployment Guide

This document describes how the Kerala Job Alert Bot is built, deployed, and monitored in production on **DigitalOcean App Platform**.

---

## 1. DigitalOcean App Platform (Production)

The production app runs as a single web service container:
* **App URL**: [https://coral-app-k4wxh.ondigitalocean.app](https://coral-app-k4wxh.ondigitalocean.app)
* **Region**: `blr1` (Bangalore, India)
* **Instance Tier**: Basic (`apps-s-1vcpu-0.5gb`)
* **Deploy on Push**: Active on branch `master`

---

## 2. Docker Multi-Stage Build

The [`Dockerfile`](file:///Users/nevin/code/personal/kerala-job-alert-bot/Dockerfile) uses a two-stage build on Alpine Linux for minimal image size and fast rollouts:

```dockerfile
# Stage 1: Build & Compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Minimal Runtime Image
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
```

---

## 3. App Platform Environment Variables

| Variable | Scope | Type | Example / Value |
| :--- | :--- | :---: | :--- |
| `BOT_TOKEN` | RUN_TIME | **SECRET** | `123456789:ABCdef...` |
| `CHANNEL_ID` | RUN_TIME | GENERAL | `@joinkeralajobsalerts` |
| `MONGODB_URI` | RUN_TIME | **SECRET** | `mongodb+srv://user:pass@cluster...` |
| `MONGODB_DB` | RUN_TIME | GENERAL | `job_alerts` |
| `PORT` | RUN_TIME | GENERAL | `8080` |
| `CRON_SCHEDULE` | RUN_TIME | GENERAL | `*/20 * * * *` |
| `CRON_ENABLED` | RUN_TIME | GENERAL | `true` |
| `RUN_JOBS_ON_STARTUP` | RUN_TIME | GENERAL | `true` |

---

## 4. Health Checks & Probes

* **Readiness & Liveness Probes**:
  DigitalOcean App Platform routes external HTTP traffic to `PORT` (`8080`).
* **Probe Endpoints**:
  * `/healthz` responds `200 ok` (`content-type: text/plain`).
  * `/` responds `200 ok` with the HTML Analytics Dashboard.
* Without the health server responding with HTTP 200, App Platform marks the container as unhealthy (`DeployContainerExitNonZero`) and rolls back.

---

## 5. Rolling Deploys & Telegram 409 Conflict

During continuous deployment on DigitalOcean:
1. App Platform boots the new container and waits for the readiness probe on `/healthz` to succeed.
2. For 10–30 seconds, both the old and new containers briefly overlap.
3. The new container attempts `getUpdates` while the old container is still active, receiving:
   ```
   409 Conflict: terminated by other getUpdates request
   ```
4. [`src/telegram/bot.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/telegram/bot.ts) automatically traps this 409 error, applies exponential backoff, and restarts polling cleanly as soon as the old container shuts down.

---

## 6. Managing via DigitalOcean MCP Server

AI agents and CLI tools can manage the live App Platform deployment directly using the `@digitalocean/mcp` server:

```json
{
  "mcpServers": {
    "digitalocean": {
      "command": "npx",
      "args": ["-y", "@digitalocean/mcp"],
      "env": {
        "DIGITALOCEAN_API_TOKEN": "<DO_PERSONAL_ACCESS_TOKEN>"
      }
    }
  }
}
```

### Common MCP Operations:
* `apps-list`: Lists all running apps and their URLs.
* `apps-get-deployment-status`: Inspects deployment progress, build logs, and health status.
* `apps-get-logs`: Streams runtime logs from the live container.
* `apps-update`: Updates environment variables or scaling configurations.
