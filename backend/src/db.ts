// D1 helpers + shared types.

export type CheckIn = {
  id: string;
  user_id: string;
  created_at: number;
  state: {
    mood?: string[];
    energy?: "low" | "mid" | "high";
    need?: string[];
    free_text?: string;
  };
  context?: {
    time_of_day?: number;
    inferred_tags?: string[];
  };
};

export type ContentItem = {
  id: string;
  type: "quote" | "grounding" | "breath" | "reframe" | "action";
  source_type: "curated" | "generated";
  text: string;
  attribution?: string;
  duration_sec?: number;
  tags: string[];
  created_at: number;
  archived: 0 | 1;
};

export type Session = {
  id: string;
  user_id: string;
  check_in_id: string;
  content_ids: string[];
  started_at: number;
  ended_at: number | null;
};

export type FeedbackEntry = {
  id: string;
  session_id: string;
  content_id: string;
  rating: "helped" | "neutral" | "missed";
  note?: string;
  created_at: number;
};

export const uid = () => {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(r, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const now = () => Date.now();

export function rowToCheckIn(row: any): CheckIn {
  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    state: JSON.parse(row.state || "{}"),
    context: row.context ? JSON.parse(row.context) : undefined,
  };
}

export function rowToContentItem(row: any): ContentItem {
  return {
    id: row.id,
    type: row.type,
    source_type: row.source_type,
    text: row.text,
    attribution: row.attribution ?? undefined,
    duration_sec: row.duration_sec ?? undefined,
    tags: JSON.parse(row.tags || "[]"),
    created_at: row.created_at,
    archived: row.archived as 0 | 1,
  };
}

export function rowToSession(row: any): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    check_in_id: row.check_in_id,
    content_ids: JSON.parse(row.content_ids || "[]"),
    started_at: row.started_at,
    ended_at: row.ended_at,
  };
}
