// GET /history?from=<ms>&to=<ms>&limit=<n>
// Returns check-ins in a window with their associated sessions and feedback.
// Default window: last 30 days, limit 100.

import { Hono } from "hono";
import type { Bindings } from "../index";
import { rowToCheckIn, rowToSession } from "../db";

export const historyRoutes = new Hono<{ Bindings: Bindings }>();

historyRoutes.get("/", async (c) => {
  const userId = c.env.DEFAULT_USER_ID;
  const now = Date.now();
  const defaultFrom = now - 30 * 24 * 60 * 60 * 1000;
  const from = Number(c.req.query("from") ?? defaultFrom);
  const to = Number(c.req.query("to") ?? now);
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);

  const ciRows = await c.env.DB.prepare(
    `SELECT * FROM check_ins
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT ?`
  )
    .bind(userId, from, to, limit)
    .all();
  const checkIns = (ciRows.results as any[]).map(rowToCheckIn);
  if (!checkIns.length) return c.json({ check_ins: [], sessions: [], feedback: [] });

  const ids = checkIns.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");

  const sRows = await c.env.DB.prepare(
    `SELECT * FROM sessions WHERE check_in_id IN (${placeholders})`
  )
    .bind(...ids)
    .all();
  const sessions = (sRows.results as any[]).map(rowToSession);

  const sessionIds = sessions.map((s) => s.id);
  let feedback: any[] = [];
  if (sessionIds.length) {
    const fbPlaceholders = sessionIds.map(() => "?").join(",");
    const fbRows = await c.env.DB.prepare(
      `SELECT * FROM feedback WHERE session_id IN (${fbPlaceholders}) ORDER BY created_at DESC`
    )
      .bind(...sessionIds)
      .all();
    feedback = (fbRows.results as any[]) ?? [];
  }

  return c.json({ check_ins: checkIns, sessions, feedback });
});

// GET /history/insights — lightweight aggregation for phase 3.
historyRoutes.get("/insights", async (c) => {
  const userId = c.env.DEFAULT_USER_ID;
  const totalCi = await c.env.DB.prepare(
    "SELECT COUNT(*) as n FROM check_ins WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ n: number }>();

  const helpedRates = await c.env.DB.prepare(
    `SELECT ci.id as content_id, ci.text, ci.type,
            SUM(CASE WHEN f.rating = 'helped' THEN 1 ELSE 0 END) as helped,
            SUM(CASE WHEN f.rating = 'missed' THEN 1 ELSE 0 END) as missed,
            COUNT(*) as total
       FROM feedback f
       JOIN content_items ci ON ci.id = f.content_id
      GROUP BY ci.id
      HAVING total >= 2
      ORDER BY (helped * 1.0 / total) DESC, total DESC
      LIMIT 10`
  ).all();

  return c.json({
    total_check_ins: totalCi?.n ?? 0,
    top_content: helpedRates.results ?? [],
  });
});
