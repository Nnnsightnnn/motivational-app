# Steady

A personal motivation and grounding companion. Logs your state of mind, serves matched content (quotes, grounding scripts, breath patterns, reframes, micro-actions), and learns what works for you over time.

Phone-first PWA. Curated content library, with Claude-generated content as a phase 2 add-on.

---

## Repo layout

```
motivational-app/
├── frontend/    PWA shell — runs as-is from a static file server
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   └── icon.svg
├── backend/     Cloudflare Worker + D1 — for phase 1 sync
│   ├── src/
│   │   ├── index.ts           Worker entry, router, auth
│   │   ├── db.ts              D1 helpers + types
│   │   ├── recommender.ts     Tag-matching + ranking
│   │   └── routes/
│   │       ├── check-in.ts    POST /check-in
│   │       ├── recommend.ts   GET /recommend
│   │       ├── feedback.ts    POST /feedback
│   │       ├── history.ts     GET /history (+ /history/insights)
│   │       └── content.ts     GET/POST/PATCH /content (+ /content/import)
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   └── 0002_seed.sql
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── content/
│   └── seed.json              40-item starter library
└── motivation-app-backend-scope.md   (in cowork outputs)
```

---

## Phase 0 — run the prototype locally (no backend yet)

The phase 0 prototype works fully offline: the seed library is fetched once and cached in `localStorage`, all check-ins and feedback are stored on-device. No backend, no account, no internet after first load.

```bash
cd ~/motivational-app
python3 -m http.server 8765
```

Then open `http://localhost:8765/frontend/index.html` in your browser.

(Port 8080 is reserved for playmakers-data. 8765 is an arbitrary free port — change it in the command above and the URLs below if it ever clashes with something else.)

To put it on your phone:
1. Make sure your Mac and phone are on the same Wi-Fi.
2. Run `ipconfig getifaddr en0` to find your Mac's IP.
3. On your phone, open `http://<your-mac-ip>:8765/frontend/index.html` in Safari.
4. Tap the Share button → "Add to Home Screen". The PWA manifest will give it a real icon.

---

## Phase 1 — deploy the backend

```bash
cd backend
npm install
npx wrangler login                           # one-time, auths to Cloudflare
npm run db:create                            # creates the D1 database, prints database_id
# Paste the printed database_id into wrangler.toml under [[d1_databases]]

npm run db:migrate:remote                    # apply 0001_init.sql + 0002_seed.sql
npx wrangler secret put API_TOKEN            # generate any random string and paste it
npm run deploy                               # deploys the Worker

# Seed the content library:
curl -X POST https://steady-api.<your-subdomain>.workers.dev/content/import \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data-binary @../content/seed.json
```

Then point the frontend at the deployed API by editing `frontend/index.html` (a `BACKEND_URL` constant will go at the top — phase 1 frontend wiring is the next session's work).

---

## API surface

All endpoints require `Authorization: Bearer <API_TOKEN>` except `GET /health`.

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health`            | Liveness probe |
| POST   | `/check-in`          | Record state, return matched content + new session |
| GET    | `/recommend`         | More content for an existing check-in |
| POST   | `/feedback`          | Did this land? helped/neutral/missed |
| GET    | `/history`           | Past check-ins, sessions, feedback |
| GET    | `/history/insights`  | What's worked best for you, top 10 |
| GET    | `/content`           | List the library |
| POST   | `/content`           | Add a curated item |
| PATCH  | `/content/:id`       | Edit or archive an item |
| POST   | `/content/import`    | Bulk-load from seed.json shape |

---

## Tag vocabulary

Three families. The check-in's mood and need chips map 1:1 to tags. Context tags are inferred server-side from the timestamp.

```
Mood     : anxious, wired, flat, sad, frustrated, scattered, overwhelmed
Need     : grounding, calming, focusing, energizing, perspective, self-compassion
Context  : morning, late-night, pre-task, post-conflict
```

Add tags as the library grows — there's no schema lock-in.

---

## Roadmap

- **Phase 0** ✅ — Static prototype, embedded library, localStorage.
- **Phase 1** — Worker + D1, frontend syncs to backend, multi-device.
- **Phase 2** — `POST /content/generate` calls the Claude API for personalized content.
- **Phase 3** — Insights view, weekly review, learned ranker.

See `motivation-app-backend-scope.md` (in the cowork outputs folder) for the full architectural rationale.


---

<p align="center">
  <a href="https://github.com/nnnsightnnn">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".brand/built-by-dark.svg">
      <img src=".brand/built-by.svg" alt="built by nnnsightnnn" height="26">
    </picture>
  </a>
</p>
