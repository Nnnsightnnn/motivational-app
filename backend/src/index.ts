// Steady API — Cloudflare Worker entry point.
// Routes are mounted via Hono. Auth is a single static bearer token.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { checkInRoutes } from "./routes/check-in";
import { recommendRoutes } from "./routes/recommend";
import { feedbackRoutes } from "./routes/feedback";
import { historyRoutes } from "./routes/history";
import { contentRoutes } from "./routes/content";

export type Bindings = {
  DB: D1Database;
  API_TOKEN: string;
  DEFAULT_USER_ID: string;
  ALLOWED_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN ?? "*";
  return cors({
    origin,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

// Bearer-token auth — applied to everything except /health.
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return c.json({ error: "missing bearer token" }, 401);
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!c.env.API_TOKEN || token !== c.env.API_TOKEN) {
    return c.json({ error: "invalid token" }, 401);
  }
  return next();
});

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.route("/check-in", checkInRoutes);
app.route("/recommend", recommendRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/history", historyRoutes);
app.route("/content", contentRoutes);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
  console.error("API error:", err);
  return c.json({ error: "internal error", detail: err.message }, 500);
});

export default app;
