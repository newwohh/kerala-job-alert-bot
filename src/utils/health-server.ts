import { createServer } from "node:http";
import { envNumber } from "@newwohh/env-safe";
import { log } from "./logger.js";

export function startHealthServer(): void {
  const port = envNumber("PORT", { default: 0, integer: true, min: 0 });
  if (port <= 0) return;

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url.startsWith("/healthz")) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, "0.0.0.0", () => {
    log("Health server listening on:", String(port));
  });
}
