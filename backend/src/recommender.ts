// Content matcher / ranker. v1: rules-based, no ML.
//
// Score = tag_overlap + 0.5 * personal_helped_rate + recency_penalty + small_random
// The recency penalty avoids serving the same item twice in a short window.

import type { CheckIn, ContentItem } from "./db";
import { rowToContentItem } from "./db";

// Five Rings lens: each `need` chip maps to one of Musashi's five books.
// The derived ring is added to the user's tag set so ring-aligned content
// (tagged with the same ring) gets a +1 overlap bonus in scoring.
export const NEED_TO_RING: Record<string, string> = {
  grounding: "earth",
  calming: "water",
  focusing: "fire",
  energizing: "fire",
  perspective: "wind",
  "self-compassion": "void",
};

export function inferContextTags(timestamp: number = Date.now()): string[] {
  const h = new Date(timestamp).getHours();
  const tags: string[] = [];
  if (h >= 5 && h < 11) tags.push("morning");
  if (h >= 22 || h < 5) tags.push("late-night");
  return tags;
}

export function checkInToTags(ci: CheckIn): string[] {
  const tags = new Set<string>();
  (ci.state.mood ?? []).forEach((t) => tags.add(t));
  (ci.state.need ?? []).forEach((t) => {
    tags.add(t);
    const ring = NEED_TO_RING[t];
    if (ring) tags.add(ring);
  });
  (ci.context?.inferred_tags ?? []).forEach((t) => tags.add(t));
  return [...tags];
}

export async function recommend(
  db: D1Database,
  ci: CheckIn,
  opts: { n?: number; excludeIds?: string[] } = {}
): Promise<ContentItem[]> {
  const n = opts.n ?? 1;
  const exclude = new Set(opts.excludeIds ?? []);
  const tags = checkInToTags(ci);

  const { results } = await db
    .prepare("SELECT * FROM content_items WHERE archived = 0")
    .all();
  const items = (results as any[]).map(rowToContentItem).filter((i) => !exclude.has(i.id));
  if (items.length === 0) return [];

  // Personal helped rates: count helped/missed per content_id for this user.
  const fbRows = await db
    .prepare(
      `SELECT content_id, rating, COUNT(*) as cnt
         FROM feedback
        GROUP BY content_id, rating`
    )
    .all();
  const personal = new Map<string, { helped: number; missed: number; total: number }>();
  for (const row of (fbRows.results as any[]) ?? []) {
    const cur = personal.get(row.content_id) ?? { helped: 0, missed: 0, total: 0 };
    if (row.rating === "helped") cur.helped += row.cnt;
    if (row.rating === "missed") cur.missed += row.cnt;
    cur.total += row.cnt;
    personal.set(row.content_id, cur);
  }

  // Recency: when was each item last shown to this user?
  const recRows = await db
    .prepare(
      `SELECT content_id, MAX(started_at) as last_shown
         FROM sessions s, json_each(s.content_ids) j
        WHERE s.user_id = ? AND j.value = content_id
        GROUP BY content_id`
    )
    .bind(ci.user_id)
    .all()
    .catch(() => ({ results: [] as any[] }));
  // Note: D1's json_each support varies. Fall back gracefully if unsupported.
  const lastShown = new Map<string, number>();
  for (const row of (recRows.results as any[]) ?? []) {
    if (row.content_id && row.last_shown) lastShown.set(row.content_id, row.last_shown);
  }

  const nowTs = Date.now();
  const scored = items.map((item) => {
    const overlap = item.tags.filter((t) => tags.includes(t)).length;
    const p = personal.get(item.id);
    const personalScore = p && p.total > 0 ? ((p.helped - p.missed) / p.total) * 0.5 : 0;
    let recencyPenalty = 0;
    const last = lastShown.get(item.id);
    if (last) {
      const days = (nowTs - last) / (1000 * 60 * 60 * 24);
      if (days < 1) recencyPenalty = -2;
      else if (days < 3) recencyPenalty = -1;
      else if (days < 7) recencyPenalty = -0.4;
    }
    const rand = Math.random() * 0.3;
    return {
      item,
      score: overlap + personalScore + recencyPenalty + rand,
      overlap,
    };
  });

  // Prefer items with at least one tag overlap; fall back to all if none match.
  const overlapping = scored.filter((s) => s.overlap > 0);
  const pool = overlapping.length > 0 ? overlapping : scored;
  pool.sort((a, b) => b.score - a.score);
  return pool.slice(0, n).map((s) => s.item);
}
