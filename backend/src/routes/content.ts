// Content management — list, add, update, archive.
// Phase 2 will add POST /content/generate (Claude API).

import { Hono } from "hono";
import type { Bindings } from "../index";
import { uid, now, rowToContentItem } from "../db";

export const contentRoutes = new Hono<{ Bindings: Bindings }>();

// GET /content?type=&archived=0
contentRoutes.get("/", async (c) => {
  const type = c.req.query("type");
  const archived = c.req.query("archived");
  let q = "SELECT * FROM content_items WHERE 1=1";
  const binds: any[] = [];
  if (type) { q += " AND type = ?"; binds.push(type); }
  if (archived !== undefined) { q += " AND archived = ?"; binds.push(Number(archived)); }
  q += " ORDER BY created_at DESC";
  const { results } = await c.env.DB.prepare(q).bind(...binds).all();
  return c.json({ items: (results as any[]).map(rowToContentItem) });
});

// POST /content — add a new curated item.
contentRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { type, text, attribution, duration_sec, tags } = body;
  if (!type || !text || !Array.isArray(tags)) {
    return c.json({ error: "type, text, tags[] required" }, 400);
  }
  const id = body.id ?? uid();
  await c.env.DB.prepare(
    `INSERT INTO content_items (id, type, source_type, text, attribution, duration_sec, tags, created_at, archived)
     VALUES (?, ?, 'curated', ?, ?, ?, ?, ?, 0)`
  )
    .bind(id, type, text, attribution ?? null, duration_sec ?? null, JSON.stringify(tags), now())
    .run();
  return c.json({ id });
});

// PATCH /content/:id — edit text/tags/archive.
contentRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const sets: string[] = [];
  const binds: any[] = [];
  for (const k of ["text", "attribution", "duration_sec"]) {
    if (k in body) { sets.push(`${k} = ?`); binds.push(body[k]); }
  }
  if ("tags" in body) {
    sets.push("tags = ?");
    binds.push(JSON.stringify(body.tags));
  }
  if ("archived" in body) {
    sets.push("archived = ?");
    binds.push(body.archived ? 1 : 0);
  }
  if (!sets.length) return c.json({ error: "no fields to update" }, 400);
  binds.push(id);
  await c.env.DB.prepare(`UPDATE content_items SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
  return c.json({ ok: true });
});

// POST /content/import — bulk-load from the seed.json shape. Idempotent on id.
contentRoutes.post("/import", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const items = body.items ?? [];
  if (!Array.isArray(items)) return c.json({ error: "items[] required" }, 400);

  let inserted = 0, updated = 0;
  for (const it of items) {
    const exists = await c.env.DB.prepare("SELECT id FROM content_items WHERE id = ?")
      .bind(it.id)
      .first();
    if (exists) {
      await c.env.DB.prepare(
        `UPDATE content_items SET type = ?, source_type = ?, text = ?, attribution = ?, duration_sec = ?, tags = ?
         WHERE id = ?`
      )
        .bind(
          it.type,
          it.source_type ?? "curated",
          it.text,
          it.attribution ?? null,
          it.duration_sec ?? null,
          JSON.stringify(it.tags ?? []),
          it.id
        )
        .run();
      updated++;
    } else {
      await c.env.DB.prepare(
        `INSERT INTO content_items (id, type, source_type, text, attribution, duration_sec, tags, created_at, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
        .bind(
          it.id ?? uid(),
          it.type,
          it.source_type ?? "curated",
          it.text,
          it.attribution ?? null,
          it.duration_sec ?? null,
          JSON.stringify(it.tags ?? []),
          now()
        )
        .run();
      inserted++;
    }
  }
  return c.json({ inserted, updated });
});
