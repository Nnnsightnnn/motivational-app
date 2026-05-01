-- Seed the default user. Content items are loaded from /content/seed.json
-- via `npm run seed-content` (Worker-side import script — TODO).
INSERT OR IGNORE INTO users (id, created_at, settings)
VALUES ('kenny', strftime('%s','now') * 1000, '{}');
