// GET /recommend?check_in_id=…&n=1
// Returns more content for an existing check-in (e.g. "show me another").

import { Hono } from "hono";
import type { Bindings } from "../index";
import { rowToCheckIn, uid, now } from "../db";
import { recommend } from "../recommender";

export const recommendRoutes = new Hono<{ Bindings: Bindings }>();

recommendRoutes.get("/", async (c) => {
  const checkInId = c.req.query("check_in_id");
  const n = Number(c.req.query("n") ?? 1);
  if (!checkInId) return c.json({ error: "check_in_id required" }, 400);

  const ciRow = await c.env.DB.prepare("SELECT * FROM check_ins WHERE id = ?")
    .bind(checkInId)
    .first();
  if (!ciRow) return c.json({ error: "check-in not found" }, 404);
  const ci = rowToCheckIn(ciRow);

  // Find prior content shown for this check-in to avoid repeats in the same session.
  const sessionRow = await c.env.DB.prepare(
    "SELECT * FROM sessions WHERE check_in_id = ? ORDER BY started_at DESC LIMIT 1"
  )
    .bind(checkInId)
    .first<any>();
  const exclude = sessionRow ? (JSON.parse(sessionRow.content_ids || "[]") as string[]) : [];

  const items = await recommend(c.env.DB, ci, { n, excludeIds: exclude });
  if (!items.length) return c.json({ recommendations: [] });

  // Append to or create a session.
  if (sessionRow) {
    const updated = [...exclude, ...items.map((i) => i.id)];
    await c.env.DB.prepare("UPDATE sessions SET content_ids = ? WHERE id = ?")
      .bind(JSON.stringify(updated), sessionRow.id)
      .run();
    return c.json({ session_id: sessionRow.id, recommendations: items });
  } else {
    const sessionId = uid();
    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, check_in_id, content_ids, started_at, ended_at) VALUES (?, ?, ?, ?, ?, NULL)"
    )
      .bind(sessionId, ci.user_id, ci.id, JSON.stringify(items.map((i) => i.id)), now())
      .run();
    return c.json({ session_id: sessionId, recommendations: items });
  }
});
