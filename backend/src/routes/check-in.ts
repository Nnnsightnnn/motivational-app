// POST /check-in
// Body: { state, context? }
// Creates a check-in, immediately starts a session, returns recommended content.

import { Hono } from "hono";
import type { Bindings } from "../index";
import { uid, now, type CheckIn } from "../db";
import { inferContextTags, recommend } from "../recommender";

export const checkInRoutes = new Hono<{ Bindings: Bindings }>();

checkInRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const userId = c.env.DEFAULT_USER_ID;

  const inferred = inferContextTags();
  const ci: CheckIn = {
    id: uid(),
    user_id: userId,
    created_at: now(),
    state: body.state ?? {},
    context: {
      time_of_day: new Date().getHours(),
      inferred_tags: inferred,
      ...(body.context ?? {}),
    },
  };

  await c.env.DB.prepare(
    "INSERT INTO check_ins (id, user_id, created_at, state, context) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(ci.id, ci.user_id, ci.created_at, JSON.stringify(ci.state), JSON.stringify(ci.context))
    .run();

  const items = await recommend(c.env.DB, ci, { n: body.n ?? 1 });
  if (!items.length) {
    return c.json({ check_in_id: ci.id, session_id: null, recommendations: [] });
  }

  const sessionId = uid();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, check_in_id, content_ids, started_at, ended_at) VALUES (?, ?, ?, ?, ?, NULL)"
  )
    .bind(sessionId, userId, ci.id, JSON.stringify(items.map((i) => i.id)), now())
    .run();

  return c.json({
    check_in_id: ci.id,
    session_id: sessionId,
    recommendations: items,
  });
});
