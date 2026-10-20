import { createServer } from "node:http";
import { config } from "../config.js";
import { getDashboardStats } from "../dashboard/stats.js";
import { renderDashboardHtml } from "../dashboard/view.js";
import { error, log } from "./logger.js";

export function startHealthServer(): void {
  const port = config.port;
  if (port <= 0) return;

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0];

    // 1. Health check probe endpoint (strictly returns 200 "ok")
    if (pathname === "/healthz") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }

    // 2. JSON Stats API endpoint
    if (pathname === "/api/stats" || pathname === "/api/dashboard") {
      try {
        const stats = await getDashboardStats();
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(stats));
      } catch (err) {
        error("Failed to generate dashboard API stats:", err);
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // 3. Web Dashboard UI
    if (pathname === "/" || pathname === "/dashboard") {
      // If a headless monitor/health check requests text/plain, return "ok"
      const accept = req.headers["accept"] ?? "";
      if (accept.includes("text/plain") && !accept.includes("text/html")) {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("ok");
        return;
      }

      try {
        const stats = await getDashboardStats();
        const html = renderDashboardHtml(stats);
        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(html);
      } catch (err) {
        error("Failed to render dashboard HTML:", err);
        // Fallback to minimal 200 ok so hosting platform readiness probe never fails
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("ok");
      }
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, "0.0.0.0", () => {
    log(`Web server & Analytics Dashboard listening on port ${port} (http://localhost:${port})`);
  });
}
