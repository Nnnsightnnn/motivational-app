// POST /feedback
// Body: { session_id, content_id, rating: 'helped'|'neutral'|'missed', note? }
// Records what worked. The single most valuable signal in the app.

import { Hono } from "hono";
import type { Bindings } from "../index";
import { uid, now } from "../db";

export const feedbackRoutes = new Hono<{ Bindings: Bindings }>();

const VALID_RATINGS = new Set(["helped", "neutral", "missed"]);

feedbackRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { session_id, content_id, rating, note } = body;

  if (!session_id || !content_id || !rating) {
    return c.json({ error: "session_id, content_id, rating required" }, 400);
  }
  if (!VALID_RATINGS.has(rating)) {
    return c.json({ error: "rating must be helped|neutral|missed" }, 400);
  }

  // Upsert: replace any prior feedback for this (session, content) pair.
  const existing = await c.env.DB.prepare(
    "SELECT id FROM feedback WHERE session_id = ? AND content_id = ?"
  )
    .bind(session_id, content_id)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare("UPDATE feedback SET rating = ?, note = ?, created_at = ? WHERE id = ?")
      .bind(rating, note ?? null, now(), existing.id)
      .run();
    return c.json({ id: existing.id, updated: true });
  }

  const id = uid();
  await c.env.DB.prepare(
    "INSERT INTO feedback (id, session_id, content_id, rating, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, session_id, content_id, rating, note ?? null, now())
    .run();

  return c.json({ id, updated: false });
});
